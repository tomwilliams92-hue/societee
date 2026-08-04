-- ============================================================================
--  SOCIETEE — database schema (Postgres / Supabase)
--
--  Run this in the Supabase SQL editor once the project exists.
--
--  THE ONE DESIGN DECISION THAT MATTERS
--  ------------------------------------
--  `rounds` is a first-class table. A round belongs to a PLAYER and a COURSE on
--  a DATE. It only OPTIONALLY belongs to an event.
--
--  That means:
--    - a society golf day writes rounds with event_id set
--    - a member's ordinary Saturday medal at his own club writes rounds with
--      event_id NULL
--  ...and both are the same shape. That is required by the core product, not
--  by anything speculative: a season-long Order of Merit counts a member's
--  qualifying club rounds, not just the days the society turns out together.
--
--  HANDICAP CONVENTION
--  -------------------
--  handicap_index is NUMERIC and PLUS GOLFERS ARE NEGATIVE — a golfer off +1.6
--  is stored as -1.6, so the arithmetic works without a special case anywhere.
--  Never store "+1.6" as a string; format it for display only.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type society_role   as enum ('owner', 'admin', 'scorer');
create type event_status   as enum ('draft', 'live', 'complete', 'cancelled');
create type scoring_format as enum ('stableford', 'medal', 'par_bogey', 'gross');
create type round_source   as enum ('manual', 'live_scoring', 'whs_import', 'csv_import');
create type plan_tier      as enum ('free', 'pro', 'club');

-- ---------------------------------------------------------------------------
-- ACCOUNTS
--   profiles = people who can LOG IN. Distinct from players (see below).
--   This is the distinction Tom pulled ChatGPT up on, and it's load-bearing.
-- ---------------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  email         text,
  display_name  text,
  home_club     text,
  created_at    timestamptz not null default now()
);

create table subscriptions (
  profile_id             uuid primary key references profiles on delete cascade,
  tier                   plan_tier not null default 'free',
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  status                 text,                 -- Stripe's status verbatim
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- COURSES  (global, shared across every society — one good course DB is a moat)
--
--   IDs are readable text slugs ('conwy', 'conwy-white'), NOT uuids. The app
--   ships a static course list and the database must agree with it exactly, so
--   a generated id would mean a lookup table and a whole class of mapping bugs
--   for no benefit. Seed with supabase/seed_courses.sql.
-- ---------------------------------------------------------------------------
create table courses (
  id          text primary key,                -- 'conwy'
  name        text not null,
  club_name   text,
  county      text,
  country     text default 'Wales',
  holes       smallint not null default 18,
  created_at  timestamptz not null default now()
);

create table tees (
  id         text primary key,                 -- 'conwy-white'
  course_id  text not null references courses on delete cascade,
  name       text not null,                    -- 'White', 'Blue', 'Yellow', 'Red'
  cr         numeric(4,1) not null,            -- Course Rating
  slope      smallint     not null,            -- Slope Rating (55-155)
  par        smallint     not null,
  unique (course_id, name)
);

-- Stroke index + par per hole. Needed for live hole-by-hole scoring; the
-- summary-only path (enter a gross, get points) works without it.
create table holes (
  tee_id       text not null references tees on delete cascade,
  hole         smallint not null check (hole between 1 and 18),
  par          smallint not null,
  stroke_index smallint not null check (stroke_index between 1 and 18),
  yards        smallint,
  primary key (tee_id, hole)
);

-- Courses and tees are reference data: readable by anyone, written by nobody
-- through the API. Keep RLS on with a read-only policy rather than off.
alter table courses enable row level security;
alter table tees    enable row level security;
alter table holes   enable row level security;
create policy "courses are public" on courses for select using (true);
create policy "tees are public"    on tees    for select using (true);
create policy "holes are public"   on holes   for select using (true);

-- ---------------------------------------------------------------------------
-- SOCIETIES
-- ---------------------------------------------------------------------------
create table societies (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles on delete cascade,
  name        text not null,
  slug        text not null unique,            -- societee.app/s/weekend-dogs
  home_club   text,
  crest_url   text,
  accent      text default '#0b6b3a',
  created_at  timestamptz not null default now()
);

-- Extra ORGANISERS. Only people with logins appear here. Free seats under the
-- owner's subscription; the plan caps how many rows a society may have.
create table society_members (
  society_id uuid not null references societies on delete cascade,
  profile_id uuid not null references profiles  on delete cascade,
  role       society_role not null default 'admin',
  created_at timestamptz not null default now(),
  primary key (society_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- PLAYERS  — NO ACCOUNT REQUIRED. This is the whole adoption story.
--   A player is a row in a society's database, nothing more. If they later
--   want their own account they claim the row and their history travels with
--   them (claimed_by).
-- ---------------------------------------------------------------------------
create table players (
  id             uuid primary key default gen_random_uuid(),
  society_id     uuid not null references societies on delete cascade,
  name           text not null,
  short_name     text,
  handicap_index numeric(4,1),                 -- plus golfers NEGATIVE (+1.6 => -1.6)
  email          text,
  whs_id         text,                         -- CDH / WHS number if known
  claimed_by     uuid references profiles on delete set null,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index on players (society_id);
create index on players (claimed_by) where claimed_by is not null;

-- ---------------------------------------------------------------------------
-- SEASONS  (the Order of Merit that runs across a summer)
-- ---------------------------------------------------------------------------
create table seasons (
  id         uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies on delete cascade,
  name       text not null,
  starts_on  date not null,
  ends_on    date not null,
  best_n     smallint,                         -- best 6 count; NULL = all rounds
  prize      text,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- EVENTS  (a golf day)
-- ---------------------------------------------------------------------------
create table events (
  id           uuid primary key default gen_random_uuid(),
  society_id   uuid not null references societies on delete cascade,
  season_id    uuid references seasons on delete set null,
  course_id    uuid references courses,
  tee_id       uuid references tees,
  name         text not null,
  plays_on     date not null,
  tee_time     time,
  format       scoring_format not null default 'stableford',
  handicap_allowance smallint not null default 95,  -- WHS: 95% for individual Stableford
  status       event_status not null default 'draft',
  share_token  text not null unique default encode(gen_random_bytes(9), 'base64'),
  entry_fee_pence integer,
  notes        text,
  created_at   timestamptz not null default now()
);
create index on events (society_id, plays_on desc);

-- A fourball. One phone in the group does the scoring, via scorer_token.
-- start_hole lives here, not on the entry: two-tee starts are per group.
create table event_groups (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events on delete cascade,
  group_no     smallint not null,
  start_hole   smallint not null default 1,
  scorer_token text not null unique default encode(gen_random_bytes(9), 'base64'),
  unique (event_id, group_no)
);

-- Who's playing, off what, in which group, from which tee
create table event_entries (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events  on delete cascade,
  player_id      uuid not null references players on delete cascade,
  playing_handicap smallint,                   -- computed at entry, then FROZEN
  group_no       smallint,
  start_hole     smallint default 1,
  paid           boolean not null default false,
  unique (event_id, player_id)
);

-- Nearest the pin / longest drive / anything else with a hole and a winner
create table side_comps (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references events on delete cascade,
  kind      text not null,                     -- 'ntp' | 'longest_drive' | free text
  hole      smallint,
  winner_id uuid references players on delete set null,
  detail    text                               -- '1.2m'
);

-- ---------------------------------------------------------------------------
-- ROUNDS  ★ the important one — see the header note
-- ---------------------------------------------------------------------------
create table rounds (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references players on delete cascade,
  event_id        uuid references events on delete cascade,   -- NULL = a solo/club round
  course_id       uuid references courses,
  tee_id          uuid references tees,
  played_on       date not null,
  format          scoring_format not null default 'stableford',

  gross           smallint,                    -- actual strokes
  adjusted_gross  smallint,                    -- WHS net double bogey adjusted
  course_handicap smallint,
  stableford      smallint,
  net             smallint,

  source          round_source not null default 'manual',
  verified        boolean not null default false,  -- true only for whs_import
  verified_at     timestamptz,
  raw             jsonb,                       -- what the importer actually saw

  created_by      uuid references profiles on delete set null,
  created_at      timestamptz not null default now(),

  -- one round per player per course per day, whatever the source
  unique (player_id, course_id, played_on)
);
create index on rounds (player_id, played_on desc);
create index on rounds (event_id) where event_id is not null;
-- the index that makes community challenges fast in Phase 3
create index on rounds (played_on, format) where verified;

-- Hole-by-hole. Only populated when someone scores live on their phone.
create table hole_scores (
  round_id  uuid not null references rounds on delete cascade,
  hole      smallint not null check (hole between 1 and 18),
  strokes   smallint,
  points    smallint,
  primary key (round_id, hole)
);

-- ---------------------------------------------------------------------------
-- OUT OF SCOPE (decided 1 Aug 2026)
--   No public community challenges, no cross-club national leaderboards, no
--   paid-entry prize competitions, no gross/scratch rankings. Societee is
--   software for society organisers. If that ever changes it is a separate
--   product decision, not a schema afterthought — don't half-build it here.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
--   Public share links read through security-definer RPCs (see below), NOT by
--   opening these tables to anon. Anonymous spectators never get raw table
--   access — they get exactly the leaderboard payload and nothing more.
-- ---------------------------------------------------------------------------
alter table profiles        enable row level security;
alter table subscriptions   enable row level security;
alter table societies       enable row level security;
alter table society_members enable row level security;
alter table players         enable row level security;
alter table seasons         enable row level security;
alter table events          enable row level security;
alter table event_entries   enable row level security;
alter table side_comps      enable row level security;
alter table rounds          enable row level security;
alter table hole_scores     enable row level security;

-- Can the current user organise this society?
create or replace function can_organise(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from societies where id = sid and owner_id = auth.uid())
      or exists (select 1 from society_members where society_id = sid and profile_id = auth.uid());
$$;

create policy "own profile"        on profiles      for all using (id = auth.uid());
create policy "own subscription"   on subscriptions for select using (profile_id = auth.uid());

create policy "read own societies" on societies for select using (can_organise(id));
create policy "create societies"   on societies for insert with check (owner_id = auth.uid());
create policy "owner edits"        on societies for update using (owner_id = auth.uid());
create policy "owner deletes"      on societies for delete using (owner_id = auth.uid());

create policy "organisers manage members" on society_members for all using (
  exists (select 1 from societies s where s.id = society_id and s.owner_id = auth.uid())
);

create policy "organisers manage players"  on players  for all using (can_organise(society_id));
create policy "organisers manage seasons"  on seasons  for all using (can_organise(society_id));
create policy "organisers manage events"   on events   for all using (can_organise(society_id));

create policy "organisers manage entries" on event_entries for all using (
  exists (select 1 from events e where e.id = event_id and can_organise(e.society_id))
);
create policy "organisers manage sidecomps" on side_comps for all using (
  exists (select 1 from events e where e.id = event_id and can_organise(e.society_id))
);
create policy "organisers manage rounds" on rounds for all using (
  exists (select 1 from players p where p.id = player_id and can_organise(p.society_id))
);
create policy "organisers manage hole scores" on hole_scores for all using (
  exists (
    select 1 from rounds r join players p on p.id = r.player_id
    where r.id = round_id and can_organise(p.society_id)
  )
);

-- ---------------------------------------------------------------------------
-- PUBLIC READ — the QR-code path. No login, no account, no app download.
-- ---------------------------------------------------------------------------
create or replace function public_leaderboard(token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'event', to_jsonb(e) - 'share_token',
    'society', jsonb_build_object('name', s.name, 'crest_url', s.crest_url, 'accent', s.accent),
    'course', to_jsonb(c),
    'standings', coalesce((
      select jsonb_agg(x order by x.stableford desc nulls last)
      from (
        select p.name, p.short_name, p.handicap_index,
               ee.playing_handicap, ee.group_no, ee.start_hole,
               r.stableford, r.gross, r.net,
               (select count(*) from hole_scores hs where hs.round_id = r.id and hs.strokes is not null) as holes_in
        from event_entries ee
        join players p on p.id = ee.player_id
        left join rounds r on r.event_id = ee.event_id and r.player_id = ee.player_id
        where ee.event_id = e.id
      ) x
    ), '[]'::jsonb),
    'side_comps', coalesce((
      select jsonb_agg(jsonb_build_object('kind', sc.kind, 'hole', sc.hole,
                                          'winner', pw.name, 'detail', sc.detail))
      from side_comps sc left join players pw on pw.id = sc.winner_id
      where sc.event_id = e.id
    ), '[]'::jsonb)
  )
  from events e
  join societies s on s.id = e.society_id
  left join courses c on c.id = e.course_id
  where e.share_token = token and e.status <> 'draft';
$$;

grant execute on function public_leaderboard(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- SCORER ACCESS — a fourball keeping the card, with no account.
--
--   The group's token is the credential. It grants exactly two things: read
--   your own group, and write a hole score for someone IN that group. It is
--   not a login, it cannot see another group, and it cannot touch anything
--   else. Anonymous users get no table grants at all — only these functions.
-- ---------------------------------------------------------------------------

create or replace function scorer_group(token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'group',   to_jsonb(g) - 'scorer_token',
    'event',   to_jsonb(e) - 'share_token',
    'course',  to_jsonb(c),
    'tee',     to_jsonb(t),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id', p.id, 'name', p.name, 'short_name', p.short_name,
        'playing_handicap', ee.playing_handicap,
        'holes', coalesce((
          select jsonb_agg(jsonb_build_object('hole', hs.hole, 'strokes', hs.strokes, 'points', hs.points))
          from rounds r join hole_scores hs on hs.round_id = r.id
          where r.event_id = e.id and r.player_id = p.id
        ), '[]'::jsonb)
      ) order by p.name)
      from event_entries ee join players p on p.id = ee.player_id
      where ee.event_id = e.id and ee.group_no = g.group_no
    ), '[]'::jsonb)
  )
  from event_groups g
  join events e   on e.id = g.event_id
  left join courses c on c.id = e.course_id
  left join tees t    on t.id = e.tee_id
  where g.scorer_token = token and e.status = 'live';
$$;

/*
 * Write one hole for one player, authorised only by the group's token.
 *
 * Points are computed HERE from the stored card, never trusted from the
 * client — otherwise anyone with a scoring link could post themselves 40
 * points. The running Stableford and gross on the round are recomputed from
 * every hole entered, so a corrected hole corrects the total.
 */
create or replace function score_hole(
  token text, p_player_id uuid, p_hole smallint, p_strokes smallint
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_event    events%rowtype;
  v_group    event_groups%rowtype;
  v_entry    event_entries%rowtype;
  v_hole     holes%rowtype;
  v_round_id uuid;
  v_ph       smallint;
  v_shots    smallint;
  v_points   smallint;
begin
  select g.* into v_group from event_groups g where g.scorer_token = token;
  if not found then raise exception 'unknown scoring link'; end if;

  select e.* into v_event from events e where e.id = v_group.event_id;
  if v_event.status <> 'live' then raise exception 'this day is not live'; end if;

  -- the player must be in THIS group
  select ee.* into v_entry from event_entries ee
   where ee.event_id = v_event.id and ee.player_id = p_player_id
     and ee.group_no = v_group.group_no;
  if not found then raise exception 'that player is not in this group'; end if;

  select h.* into v_hole from holes h where h.tee_id = v_event.tee_id and h.hole = p_hole;
  if not found then raise exception 'no scorecard for this tee'; end if;

  v_ph := coalesce(v_entry.playing_handicap, 0);

  select r.id into v_round_id from rounds r
   where r.event_id = v_event.id and r.player_id = p_player_id;
  if v_round_id is null then
    insert into rounds (player_id, event_id, course_id, tee_id, played_on, format,
                        course_handicap, source, verified)
    values (p_player_id, v_event.id, v_event.course_id, v_event.tee_id, v_event.plays_on,
            v_event.format, v_ph, 'live_scoring', false)
    returning id into v_round_id;
  end if;

  delete from hole_scores where round_id = v_round_id and hole = p_hole;

  if p_strokes is not null and p_strokes > 0 then
    -- strokes received: whole passes of 18, plus one on the hardest holes
    v_shots := (v_ph / 18) + case when v_hole.stroke_index <= (v_ph % 18) then 1 else 0 end;
    if v_ph < 0 then
      v_shots := case when (19 - v_hole.stroke_index) <= abs(v_ph) then -1 else 0 end;
    end if;
    v_points := greatest(0, v_hole.par - (p_strokes - v_shots) + 2)::smallint;
    insert into hole_scores (round_id, hole, strokes, points)
    values (v_round_id, p_hole, p_strokes, v_points);
  end if;

  -- sum() returns bigint, so cast back explicitly rather than relying on an
  -- implicit assignment cast into smallint columns
  update rounds r set
    gross           = s.strokes,
    adjusted_gross  = s.strokes,
    stableford      = s.points,
    net             = case when s.strokes is null then null else (s.strokes - v_ph)::smallint end,
    course_handicap = v_ph
  from (
    select nullif(sum(strokes), 0)::smallint as strokes,
           sum(points)::smallint             as points
    from hole_scores where round_id = v_round_id
  ) s
  where r.id = v_round_id;
end;
$$;

grant execute on function scorer_group(text)                        to anon, authenticated;
grant execute on function score_hole(text, uuid, smallint, smallint) to anon, authenticated;

alter table event_groups enable row level security;
create policy "organisers manage groups" on event_groups for all using (
  exists (select 1 from events e where e.id = event_id and can_organise(e.society_id))
);
