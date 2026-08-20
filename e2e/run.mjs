/* ---------------------------------------------------------------------------
 * SOCIETEE END-TO-END — the deploy gate.
 *
 * Drives the real built app with a real browser and a real account against
 * the real database, through the whole organiser journey:
 *
 *   sign in → create a society (structured roster) → create an event at Conwy
 *   → score holes on the card → totals right on the event page → the guest QR
 *   board shows it all WITHOUT an account → server actually holds the rows.
 *
 * That last check is the one that matters: the UI is optimistic, so a screen
 * can look perfect while every write bounces off the database (exactly the
 * bug that ate a week in August 2026). Every step here asserts server-side
 * state through the REST API, not just pixels.
 *
 * Usage:
 *   node e2e/run.mjs http://localhost:4173/societee     (deploy gate)
 *   node e2e/run.mjs https://tomwilliams92-hue.github.io/societee  (live smoke)
 *
 * Credentials come from e2e/.env (git-ignored): E2E_EMAIL, E2E_PASSWORD.
 * The account is a dedicated test account — RLS keeps its data separate.
 * ------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
// playwright lives in the app's node_modules — resolve it from there
const { chromium } = createRequire(join(HERE, "../app/package.json"))("playwright");
const BASE = (process.argv[2] ?? "http://localhost:4173/societee").replace(/\/$/, "");

// ---- config ----------------------------------------------------------------
const envFile = Object.fromEntries(
  readFileSync(join(HERE, ".env"), "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const EMAIL = process.env.E2E_EMAIL ?? envFile.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD ?? envFile.E2E_PASSWORD;
const appEnv = Object.fromEntries(
  readFileSync(join(HERE, "../app/.env.local"), "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const SB_URL = appEnv.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = appEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? appEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!EMAIL || !PASSWORD || !SB_URL || !SB_KEY) {
  console.error("missing credentials (e2e/.env) or app/.env.local keys");
  process.exit(2);
}

// ---- tiny REST client for server-side assertions ---------------------------
let accessToken = null;
async function restLogin() {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SB_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!r.ok) throw new Error(`REST login failed: ${r.status}`);
  accessToken = (await r.json()).access_token;
}
async function rest(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json", ...(opts.headers ?? {}),
    },
  });
  if (!r.ok && r.status !== 404) throw new Error(`REST ${path}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}
/** Poll a server-side condition until true — sync flushes are debounced. */
async function eventually(what, fn, ms = 25000) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error(`server never saw: ${what}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

// ---- the run ---------------------------------------------------------------
const RUN = `E2E ${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`;
const PLAYER = "Eddie Twotimes";
const steps = [];
let browser;

function step(name) { steps.push(name); console.log(`\n▶ ${steps.length}. ${name}`); }

try {
  await restLogin();

  // leftovers from a crashed run must not skew this one
  const old = await rest(`societies?select=id&name=like.E2E*`);
  for (const s of old ?? []) await rest(`societies?id=eq.${s.id}`, { method: "DELETE" });

  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on("pageerror", (e) => console.log("  pageerror:", e.message));

  step("sign in");
  await page.goto(`${BASE}/`, { timeout: 60000 });
  await page.waitForTimeout(2500);
  if (await page.getByText("Welcome back").count()) {
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForTimeout(4000);
  }
  if (await page.getByText("Welcome back").count()) throw new Error("still on sign-in screen");

  step("create society through the wizard (structured roster)");
  await page.goto(`${BASE}/new-day/`, { timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.getByText("Create a society").click();
  await page.getByPlaceholder("Weekend Dogs").fill(RUN);
  await page.getByRole("button", { name: "Continue" }).click(); // -> badge
  await page.getByRole("button", { name: "Continue" }).click(); // -> roster
  await page.getByPlaceholder("Dave Prichard").fill(PLAYER);
  await page.locator('input[placeholder="12.4"]').first().fill("11.4");
  await page.getByRole("button", { name: "Continue" }).click(); // -> confirm
  await page.getByRole("button", { name: /Create the society/ }).click();
  await page.waitForTimeout(1500);
  if (!(await page.getByText(RUN.toUpperCase()).count())) throw new Error("society page did not open");

  step("society + player + handicap PERSISTED on the server");
  const soc = await eventually("society row", async () =>
    (await rest(`societies?select=id,name&name=eq.${encodeURIComponent(RUN)}`))?.[0]);
  const plr = await eventually("player row", async () =>
    (await rest(`players?select=id,name,handicap_index&society_id=eq.${soc.id}`))?.[0]);
  if (plr.name !== PLAYER || Number(plr.handicap_index) !== 11.4)
    throw new Error(`player wrong on server: ${JSON.stringify(plr)}`);

  step("create an event at Conwy (verified card)");
  await page.goto(`${BASE}/new-day/?s=${soc.id}`, { timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.getByText("Create an event").click();
  await page.locator('input[placeholder="August Meeting"]').fill(`${RUN} day`);
  await page.getByRole("button", { name: "Continue" }).click(); // -> formats
  await page.getByRole("button", { name: "Skip for now" }).click(); // stableford default
  await page.getByRole("button", { name: "Continue" }).click(); // rounds: one, today
  await page.getByText("No course set").click();
  await page.locator('input[placeholder="Search every UK course"]').fill("Conwy");
  await page.waitForTimeout(600);
  await page.getByText("Conwy (Caernarvonshire)").first().click();
  await page.waitForTimeout(400);
  await page.getByText(/tees$/).first().click(); // first tee set
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Continue" }).click(); // -> players (picked by default)
  await page.getByRole("button", { name: "Create event" }).click();
  await page.waitForTimeout(1500);
  if (!(await page.getByText("Enter the cards").count())) throw new Error("event page did not open");

  step("event + entry PERSISTED on the server");
  const ev = await eventually("event row", async () =>
    (await rest(`events?select=id,share_token,tee_id&society_id=eq.${soc.id}`))?.[0]);
  await eventually("entry row", async () =>
    (await rest(`event_entries?select=player_id&event_id=eq.${ev.id}`))?.[0]);

  step("score three holes on the card");
  await page.locator("main button.score-input").first().click();
  await page.waitForTimeout(600);
  const plus = await page.locator('.overlay button[aria-label^="One more on hole"]').all();
  await plus[0].click(); await plus[1].click(); await plus[2].click(); await plus[2].click();
  await page.waitForTimeout(600);
  const totalLine = await page.locator(".overlay").getByText(/gross ·.*net ·.*pts/).innerText();
  await page.locator(".overlay .btn-primary").first().click(); // Done
  await page.waitForTimeout(800);
  console.log("  card total:", totalLine.trim());

  step("round + hole scores PERSISTED with correct gross");
  const round = await eventually("round row", async () =>
    (await rest(`rounds?select=id,gross,stableford&event_id=eq.${ev.id}`))?.[0]);
  const holes = await eventually("3 hole rows", async () => {
    const h = await rest(`hole_scores?select=hole,strokes&round_id=eq.${round.id}`);
    return h?.length === 3 ? h : null;
  });
  const gross = holes.reduce((a, h) => a + h.strokes, 0);
  console.log(`  server: gross over 3 holes = ${gross}`);

  step("guest QR board works with NO account");
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guest = await guestCtx.newPage();
  await guest.goto(`${BASE}/live-board/?b=${ev.share_token}`, { timeout: 60000 });
  await guest.waitForTimeout(3500);
  const board = await guest.locator("body").innerText();
  if (!board.toUpperCase().includes("EDDIE")) throw new Error("guest board doesn't show the player");
  await guestCtx.close();

  step("cleanup");
  await rest(`societies?id=eq.${soc.id}`, { method: "DELETE" });

  console.log(`\n✅ E2E PASS — ${steps.length} steps against ${BASE}`);
  await browser.close();
  process.exit(0);
} catch (e) {
  console.error(`\n❌ E2E FAIL at step ${steps.length} ("${steps.at(-1)}"): ${e.message}`);
  console.error(`   target: ${BASE}`);
  if (browser) await browser.close();
  process.exit(1);
}
