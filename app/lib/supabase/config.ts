/* ---------------------------------------------------------------------------
 * Which mode is the app in?
 *
 *   demo   — no Supabase keys. Everything lives in localStorage, seeded with
 *            invented societies. This is what runs today, with no accounts and
 *            no network. Share links only work in the browser that made them.
 *
 *   remote — Supabase keys present. Real database, real logins, and a QR code
 *            that works on somebody else's phone.
 *
 * The app is deliberately usable in demo mode forever, so the product can be
 * shown to someone on a laptop with no signal.
 * ------------------------------------------------------------------------- */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const IS_REMOTE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export type Mode = "demo" | "remote";
export const MODE: Mode = IS_REMOTE ? "remote" : "demo";
