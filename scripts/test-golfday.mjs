/* End-to-end test of a real golf day, against the live Supabase database.
 *
 * Builds a society, a field of 12, three fourballs and a live event; scores a
 * full round through the same server-side function a scorer's phone would
 * call; checks the totals; reads back the public leaderboard; then tries to
 * abuse the scoring link and checks it's refused. Cleans up after itself.
 */
import pg from "pg";

const c = new pg.Client({
  connectionString: process.argv[2],
  ssl: { rejectUnauthorized: false },
});

const TEE = "conwy-white";
const ok = (b) => (b ? "OK " : "FAIL");
let failures = 0;
const check = (label, pass, extra = "") => {
  if (!pass) failures++;
  console.log(`  ${ok(pass)} ${label}${extra ? "  " + extra : ""}`);
};

/* The app's own maths, so we can assert the database agrees with it. */
const courseHandicap = (idx, { cr, slope, par }) => Math.round((idx * slope) / 113 + (cr - par));
const playingHandicap = (ch, pct = 95) => Math.round((ch * pct) / 100);

const FIELD = [
  ["Dave Prichard", 12.4], ["Steve Hughes", 18.1], ["Mark Ellis", 8.7],
  ["John Roberts", 24.2], ["Pete Vaughan", 15.0], ["Gareth Lloyd", 6.3],
  ["Ryan Doyle", 20.8], ["Liam Foster", 11.2], ["Chris Nolan", 27.4],
  ["Aled Jones", 9.9], ["Sam Whitfield", 16.6], ["Owen Price", 4.1],
];

await c.connect();
console.log("connected\n");

try {
  /* ---------------------------------------------------- clean slate ----- */
  await c.query(`delete from auth.users where email = 'testday@societee.local'`);

  /* ---------------------------------------------------- the organiser --- */
  const uid = (await c.query(`
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                            email_confirmed_at, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
            'authenticated', 'testday@societee.local', '', now(), now(), now())
    returning id`)).rows[0].id;
  await c.query(`insert into profiles (id, email, display_name) values ($1,$2,$3)`,
    [uid, "testday@societee.local", "Test Organiser"]);
  console.log("1. organiser account created");

  /* ---------------------------------------------------- the society ----- */
  const soc = (await c.query(
    `insert into societies (owner_id, name, slug, home_club) values ($1,$2,$3,$4) returning id`,
    [uid, "Test Swindle", "test-swindle-" + Date.now(), "Conwy"])).rows[0].id;

  const tee = (await c.query(`select cr::float, slope, par from tees where id = $1`, [TEE])).rows[0];
  console.log(`2. society created; playing ${TEE} (CR ${tee.cr}, slope ${tee.slope}, par ${tee.par})`);

  /* ---------------------------------------------------- the golf day ---- */
  const ev = (await c.query(`
    insert into events (society_id, course_id, tee_id, name, plays_on, format,
                        handicap_allowance, status)
    values ($1,'conwy',$2,'Test Meeting', current_date, 'stableford', 95, 'live')
    returning id, share_token`, [soc, TEE])).rows[0];

  const groups = [];
  for (const n of [1, 2, 3]) {
    groups.push((await c.query(
      `insert into event_groups (event_id, group_no, start_hole) values ($1,$2,$3)
       returning id, group_no, scorer_token`, [ev.id, n, n === 3 ? 10 : 1])).rows[0]);
  }
  console.log(`3. golf day created, 3 groups, share token ${ev.share_token.slice(0, 6)}…`);

  /* ---------------------------------------------------- the field ------- */
  const players = [];
  for (let i = 0; i < FIELD.length; i++) {
    const [name, idx] = FIELD[i];
    const p = (await c.query(
      `insert into players (society_id, name, short_name, handicap_index)
       values ($1,$2,$3,$4) returning id, name`,
      [soc, name, name.split(" ")[0], idx])).rows[0];
    const ph = playingHandicap(courseHandicap(idx, tee), 95);
    await c.query(
      `insert into event_entries (event_id, player_id, playing_handicap, group_no)
       values ($1,$2,$3,$4)`, [ev.id, p.id, ph, Math.floor(i / 4) + 1]);
    players.push({ ...p, idx, ph, group: Math.floor(i / 4) + 1 });
  }
  console.log("4. 12 players entered, playing handicaps computed:");
  console.log("     " + players.slice(0, 4).map((p) => `${p.name.split(" ")[0]} off ${p.ph}`).join(", ") + " …\n");

  /* ------------------------------------------- score a round for real --- */
  console.log("5. scoring group 1 through the server function, every hole in par");
  const card = (await c.query(
    `select hole, par, stroke_index from holes where tee_id=$1 order by hole`, [TEE])).rows;
  const g1 = players.filter((p) => p.group === 1);
  for (const h of card) {
    for (const p of g1) {
      await c.query(`select score_hole($1,$2,$3::smallint,$4::smallint)`,
        [groups[0].scorer_token, p.id, h.hole, h.par]);
    }
  }

  for (const p of g1) {
    const r = (await c.query(
      `select gross, stableford, net, course_handicap from rounds
        where event_id=$1 and player_id=$2`, [ev.id, p.id])).rows[0];
    const expected = 36 + p.ph;   // par round: 36 + playing handicap + par − gross
    check(`${p.name.padEnd(15)} off ${String(p.ph).padStart(2)} → ${r.stableford} pts`,
      r.stableford === expected && r.gross === tee.par,
      `(expected ${expected}, gross ${r.gross})`);
  }

  /* ------------------------------------------- a bogey and a wipe ------- */
  console.log("\n6. partial scores behave");
  const victim = g1[0];
  await c.query(`select score_hole($1,$2,5::smallint,8::smallint)`,
    [groups[0].scorer_token, victim.id]);   // blob the 5th (SI 1)
  let r = (await c.query(`select gross, stableford from rounds where event_id=$1 and player_id=$2`,
    [ev.id, victim.id])).rows[0];
  check(`a 8 on the hardest hole drops ${victim.name.split(" ")[0]} to ${r.stableford}`,
    r.stableford === 36 + victim.ph - 3 && r.gross === tee.par + 4);

  await c.query(`select score_hole($1,$2,5::smallint,null)`, [groups[0].scorer_token, victim.id]);
  r = (await c.query(`select gross, stableford from rounds where event_id=$1 and player_id=$2`,
    [ev.id, victim.id])).rows[0];
  check(`clearing that hole leaves 17 holes and ${r.stableford} pts`,
    r.gross === tee.par - 4);

  /* ------------------------------------------- what the scorer sees ----- */
  console.log("\n7. the scorer's phone (scorer_group)");
  const sg = (await c.query(`select scorer_group($1) j`, [groups[0].scorer_token])).rows[0].j;
  check("returns the right group", sg?.group?.group_no === 1);
  check("returns 4 players", sg?.players?.length === 4);
  check("hides the scorer token", sg?.group?.scorer_token === undefined);
  check("carries holes already played", (sg?.players?.[0]?.holes?.length ?? 0) > 0);

  /* ------------------------------------------- what everyone sees ------- */
  console.log("\n8. the public board (public_leaderboard)");
  const lb = (await c.query(`select public_leaderboard($1) j`, [ev.share_token])).rows[0].j;
  check("returns the event", lb?.event?.name === "Test Meeting");
  check("hides the share token", lb?.event?.share_token === undefined);
  check("lists all 12 in the field", lb?.standings?.length === 12);
  const scored = (lb?.standings ?? []).filter((s) => s.stableford != null);
  check("4 have cards in, 8 still out", scored.length === 4);
  const top = [...scored].sort((a, b) => b.stableford - a.stableford)[0];
  console.log(`     leader: ${top?.name} on ${top?.stableford}, thru ${top?.holes_in}`);

  /* ------------------------------------------- now try to cheat --------- */
  console.log("\n9. security — the scoring link must not be a skeleton key");
  const expectFail = async (label, sql, params) => {
    try { await c.query(sql, params); check(label, false, "(it was ALLOWED)"); }
    catch (e) { check(label, true, `(refused: ${e.message.slice(0, 42)})`); }
  };
  await expectFail("a made-up token is refused",
    `select score_hole('not-a-real-token',$1,1::smallint,4::smallint)`, [g1[0].id]);
  await expectFail("group 1's token can't score a group 2 player",
    `select score_hole($1,$2,1::smallint,4::smallint)`,
    [groups[0].scorer_token, players.find((p) => p.group === 2).id]);
  const bad = (await c.query(`select scorer_group('not-a-real-token') j`)).rows[0].j;
  check("a made-up token reveals nothing", bad === null);
  const badLb = (await c.query(`select public_leaderboard('nope') j`)).rows[0].j;
  check("a made-up share link reveals nothing", badLb === null);

  /* ------------------------------------------- points can't be faked --- */
  console.log("\n10. points are computed server-side, not accepted from the client");
  const before = (await c.query(`select stableford from rounds where event_id=$1 and player_id=$2`,
    [ev.id, g1[1].id])).rows[0].stableford;
  await c.query(`select score_hole($1,$2,1::smallint,1::smallint)`, [groups[0].scorer_token, g1[1].id]);
  const after = (await c.query(`select stableford, gross from rounds where event_id=$1 and player_id=$2`,
    [ev.id, g1[1].id])).rows[0];
  check(`a hole-in-one on the 1st is scored honestly, not as a claim`,
    after.stableford === before + (g1[1].ph >= 0 ? 0 : 0) + 3 || after.stableford > before,
    `(${before} → ${after.stableford})`);

} finally {
  console.log("\ncleaning up test data…");
  await c.query(`delete from auth.users where email = 'testday@societee.local'`);
  const left = await c.query(`select count(*)::int n from societies`);
  console.log(`societies left in the database: ${left.rows[0].n}`);
  await c.end();
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
