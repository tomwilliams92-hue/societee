"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A copy button that answers back. Tapping it flips to "Copied ✓" for a
 * couple of seconds — WhatsApping a link you only HOPE is on the clipboard
 * is not a share flow. Falls back through the older execCommand path for
 * webviews where the async clipboard API is missing.
 */
export function CopyButton({ text, label = "Copy link", className }: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // older webviews: hidden textarea + execCommand
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        ta.remove();
      } catch { ok = false; }
    }
    setCopied(ok);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      className={className ?? "btn btn-ghost"}
      style={copied ? { borderColor: "var(--color-acid)", color: "var(--color-acid)" } : undefined}
      onClick={copy}
      aria-live="polite"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
