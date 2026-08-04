"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SocietyView } from "./SocietyView";

/**
 * Identifier travels in the query string, not the path.
 *
 * A path like /s/weekend-dogs can't exist as a file until someone has created
 * that society, so it can't be part of a static export — and a static export is
 * exactly what a native iOS shell has to bundle. A query string sidesteps that
 * completely: one file, any identifier, works offline.
 */
function Inner() {
  const slug = useSearchParams().get("s") ?? "";
  return <SocietyView slug={slug} />;
}

export default function Page() {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <Inner />
    </Suspense>
  );
}
