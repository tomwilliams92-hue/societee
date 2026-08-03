"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, IS_REMOTE } from "./config";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser Supabase client, or null in demo mode. Singleton — don't recreate. */
export function supabase() {
  if (!IS_REMOTE) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
