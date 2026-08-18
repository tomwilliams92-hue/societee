-- ============================================================================
--  SOCIETEE — upgrade 1 (run once in the SQL editor, after schema.sql)
--
--  1. Seeds the per-hole scorecards (score_hole needs them).
--  2. Lets signed-in organisers ADD course/tee/card rows — community
--     accumulation, insert-only, nobody can overwrite anyone else's data.
--  3. Self-registration: a flag on events, an info RPC, and a register RPC so
--     a player can put themselves in the field from their own phone.
--  4. A full public-board RPC with per-hole detail for the QR spectator view.
-- ============================================================================

-- 2. community course data ---------------------------------------------------
drop policy if exists "signed-in users add courses" on courses;
drop policy if exists "signed-in users add tees"    on tees;
drop policy if exists "signed-in users add holes"   on holes;
create policy "signed-in users add courses" on courses for insert to authenticated with check (true);
create policy "signed-in users add tees"    on tees    for insert to authenticated with check (true);
create policy "signed-in users add holes"   on holes   for insert to authenticated with check (true);

-- 3. self-registration -------------------------------------------------------
alter table events add column if not exists self_register boolean not null default false;

create or replace function register_info(token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', e.name, 'plays_on', e.plays_on, 'society', s.name,
    'course', c.name, 'open', e.self_register and e.status in ('draft','live')
  )
  from events e
  join societies s on s.id = e.society_id
  left join courses c on c.id = e.course_id
  where e.share_token = token;
$$;

create or replace function register_player(token text, p_name text, p_hcp numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_event  events%rowtype;
  v_player players%rowtype;
  v_tee    tees%rowtype;
  v_ch     smallint;
  v_ph     smallint;
begin
  select e.* into v_event from events e where e.share_token = token;
  if not found then raise exception 'unknown registration link'; end if;
  if not v_event.self_register or v_event.status not in ('draft','live') then
    raise exception 'registration is closed for this event';
  end if;
  if p_name is null or length(trim(p_name)) < 2 then raise exception 'name required'; end if;
  if p_hcp is not null and (p_hcp < -9.9 or p_hcp > 54) then raise exception 'handicap out of range'; end if;

  -- same name in this society = same golfer; never a duplicate row
  select p.* into v_player from players p
   where p.society_id = v_event.society_id
     and lower(trim(p.name)) = lower(trim(p_name));
  if not found then
    insert into players (society_id, name, short_name, handicap_index)
    values (v_event.society_id, trim(p_name), split_part(trim(p_name), ' ', 1), p_hcp)
    returning * into v_player;
  elsif p_hcp is not null then
    update players set handicap_index = p_hcp where id = v_player.id;
  end if;

  -- freeze the playing handicap now, exactly as the app would
  if v_event.tee_id is not null and coalesce(p_hcp, v_player.handicap_index) is not null then
    select t.* into v_tee from tees t where t.id = v_event.tee_id;
    if found then
      v_ch := round(coalesce(p_hcp, v_player.handicap_index) * v_tee.slope / 113.0
                    + (v_tee.cr - v_tee.par));
      v_ph := round(v_ch * v_event.handicap_allowance / 100.0);
    end if;
  end if;

  insert into event_entries (event_id, player_id, playing_handicap)
  values (v_event.id, v_player.id, v_ph)
  on conflict (event_id, player_id) do nothing;

  return jsonb_build_object('player', v_player.name, 'playing_handicap', v_ph);
end;
$$;

grant execute on function register_info(text)                    to anon, authenticated;
grant execute on function register_player(text, text, numeric)   to anon, authenticated;

-- 4. full public board -------------------------------------------------------
create or replace function public_board_full(token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'event',   to_jsonb(e) - 'share_token',
    'society', jsonb_build_object('id', s.id, 'name', s.name, 'accent', s.accent, 'slug', s.slug),
    'tee',     to_jsonb(t),
    'holes',   coalesce((select jsonb_agg(to_jsonb(h) order by h.hole)
                         from holes h where h.tee_id = e.tee_id), '[]'::jsonb),
    'players', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', p.id, 'name', p.name, 'short_name', p.short_name,
                  'handicap_index', p.handicap_index))
                from players p where p.id in
                  (select player_id from event_entries where event_id = e.id)), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(to_jsonb(ee))
                from event_entries ee where ee.event_id = e.id), '[]'::jsonb),
    'rounds',  coalesce((select jsonb_agg(to_jsonb(r))
                from rounds r where r.event_id = e.id), '[]'::jsonb),
    'hole_scores', coalesce((select jsonb_agg(to_jsonb(hs))
                from hole_scores hs
                where hs.round_id in (select id from rounds where event_id = e.id)), '[]'::jsonb),
    'side_comps', coalesce((select jsonb_agg(to_jsonb(sc))
                from side_comps sc where sc.event_id = e.id), '[]'::jsonb)
  )
  from events e
  join societies s on s.id = e.society_id
  left join tees t on t.id = e.tee_id
  where e.share_token = token and e.status <> 'draft';
$$;

grant execute on function public_board_full(text) to anon, authenticated;

-- scorer_group, now including the hole card — the scorer screen needs par and
-- stroke index to show shots received while the fourball is stood on the tee
create or replace function scorer_group(token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'group',   to_jsonb(g) - 'scorer_token',
    'event',   to_jsonb(e) - 'share_token',
    'course',  to_jsonb(c),
    'tee',     to_jsonb(t),
    'holes',   coalesce((select jsonb_agg(to_jsonb(h) order by h.hole)
                         from holes h where h.tee_id = e.tee_id), '[]'::jsonb),
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

-- 1. hole cards for the verified tees ---------------------------------------
insert into holes (tee_id, hole, par, stroke_index) values
  ('conwy-blue', 1, 4, 13),
  ('conwy-blue', 2, 3, 15),
  ('conwy-blue', 3, 4, 9),
  ('conwy-blue', 4, 4, 5),
  ('conwy-blue', 5, 4, 1),
  ('conwy-blue', 6, 3, 17),
  ('conwy-blue', 7, 4, 7),
  ('conwy-blue', 8, 4, 3),
  ('conwy-blue', 9, 5, 11),
  ('conwy-blue', 10, 5, 10),
  ('conwy-blue', 11, 4, 4),
  ('conwy-blue', 12, 5, 6),
  ('conwy-blue', 13, 3, 12),
  ('conwy-blue', 14, 5, 16),
  ('conwy-blue', 15, 3, 18),
  ('conwy-blue', 16, 4, 8),
  ('conwy-blue', 17, 4, 2),
  ('conwy-blue', 18, 4, 14),
  ('conwy-white', 1, 4, 13),
  ('conwy-white', 2, 3, 15),
  ('conwy-white', 3, 4, 9),
  ('conwy-white', 4, 4, 5),
  ('conwy-white', 5, 4, 1),
  ('conwy-white', 6, 3, 17),
  ('conwy-white', 7, 4, 7),
  ('conwy-white', 8, 4, 3),
  ('conwy-white', 9, 5, 11),
  ('conwy-white', 10, 5, 10),
  ('conwy-white', 11, 4, 4),
  ('conwy-white', 12, 5, 6),
  ('conwy-white', 13, 3, 12),
  ('conwy-white', 14, 5, 16),
  ('conwy-white', 15, 3, 18),
  ('conwy-white', 16, 4, 8),
  ('conwy-white', 17, 4, 2),
  ('conwy-white', 18, 4, 14),
  ('bromborough-white', 1, 4, 13),
  ('bromborough-white', 2, 4, 5),
  ('bromborough-white', 3, 5, 7),
  ('bromborough-white', 4, 3, 17),
  ('bromborough-white', 5, 4, 1),
  ('bromborough-white', 6, 3, 15),
  ('bromborough-white', 7, 5, 9),
  ('bromborough-white', 8, 4, 11),
  ('bromborough-white', 9, 4, 3),
  ('bromborough-white', 10, 3, 16),
  ('bromborough-white', 11, 5, 4),
  ('bromborough-white', 12, 4, 12),
  ('bromborough-white', 13, 4, 14),
  ('bromborough-white', 14, 4, 8),
  ('bromborough-white', 15, 4, 2),
  ('bromborough-white', 16, 3, 18),
  ('bromborough-white', 17, 5, 10),
  ('bromborough-white', 18, 4, 6),
  ('wallasey-white', 1, 4, 11),
  ('wallasey-white', 2, 4, 5),
  ('wallasey-white', 3, 4, 7),
  ('wallasey-white', 4, 5, 1),
  ('wallasey-white', 5, 3, 15),
  ('wallasey-white', 6, 4, 13),
  ('wallasey-white', 7, 5, 3),
  ('wallasey-white', 8, 4, 9),
  ('wallasey-white', 9, 3, 17),
  ('wallasey-white', 10, 4, 12),
  ('wallasey-white', 11, 4, 8),
  ('wallasey-white', 12, 3, 18),
  ('wallasey-white', 13, 5, 2),
  ('wallasey-white', 14, 5, 16),
  ('wallasey-white', 15, 4, 6),
  ('wallasey-white', 16, 3, 14),
  ('wallasey-white', 17, 4, 4),
  ('wallasey-white', 18, 4, 10),
  ('stmelyd-white', 1, 5, 12),
  ('stmelyd-white', 2, 4, 4),
  ('stmelyd-white', 3, 4, 14),
  ('stmelyd-white', 4, 3, 16),
  ('stmelyd-white', 5, 4, 2),
  ('stmelyd-white', 6, 3, 8),
  ('stmelyd-white', 7, 5, 6),
  ('stmelyd-white', 8, 3, 18),
  ('stmelyd-white', 9, 4, 10),
  ('stmelyd-white', 10, 4, 3),
  ('stmelyd-white', 11, 4, 5),
  ('stmelyd-white', 12, 4, 13),
  ('stmelyd-white', 13, 3, 17),
  ('stmelyd-white', 14, 4, 1),
  ('stmelyd-white', 15, 3, 7),
  ('stmelyd-white', 16, 5, 11),
  ('stmelyd-white', 17, 3, 15),
  ('stmelyd-white', 18, 4, 9),
  ('abergele-white', 1, 4, 14),
  ('abergele-white', 2, 3, 16),
  ('abergele-white', 3, 5, 6),
  ('abergele-white', 4, 4, 18),
  ('abergele-white', 5, 3, 12),
  ('abergele-white', 6, 4, 2),
  ('abergele-white', 7, 4, 10),
  ('abergele-white', 8, 5, 4),
  ('abergele-white', 9, 4, 8),
  ('abergele-white', 10, 4, 9),
  ('abergele-white', 11, 5, 15),
  ('abergele-white', 12, 4, 1),
  ('abergele-white', 13, 3, 13),
  ('abergele-white', 14, 4, 5),
  ('abergele-white', 15, 4, 17),
  ('abergele-white', 16, 4, 3),
  ('abergele-white', 17, 3, 11),
  ('abergele-white', 18, 5, 7)
on conflict (tee_id, hole) do update set
  par = excluded.par, stroke_index = excluded.stroke_index;

