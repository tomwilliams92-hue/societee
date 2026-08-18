"use client";

import { useEffect } from "react";
import { startSync } from "@/lib/supabase/sync";

/** Kicks the sync engine off once on the client. Renders nothing. */
export function SyncBoot() {
  useEffect(() => { startSync(); }, []);
  return null;
}
