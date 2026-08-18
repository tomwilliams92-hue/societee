import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The native iOS shell.
 *
 * `webDir: "out"` is the static export produced by `npm run build:native` —
 * real files bundled inside the app, NOT a URL loaded from a server. That
 * distinction matters twice over: the app opens instantly and works with no
 * signal, and it is not the "website in a box" that App Review rejects under
 * guideline 4.2.
 *
 * appId can still change before the first submission — it only has to be
 * unique and is conventionally the reverse of a domain you control.
 */
const config: CapacitorConfig = {
  appId: "uk.co.societee.app",
  appName: "Societee",
  webDir: "out",
  ios: {
    // "never", not "always": contentInsetAdjustment acts on the webview's
    // scroll view, and this app's body never scrolls (the shell scrolls inside
    // .app-scroll) — so "always" silently did nothing and content sat under
    // the status bar. Instead the webview runs edge-to-edge and the CSS does
    // the work: viewport-fit=cover + env(safe-area-inset-top) padding + the
    // fixed .statusbar-scrim behind the clock. Same mechanism as the PWA.
    contentInset: "never",
    backgroundColor: "#06080a",
    // Scoring happens outdoors in daylight; never flip to a light UI.
    preferredContentMode: "mobile",
  },
  server: {
    // No `url` here on purpose. Pointing at a live site is what Capacitor's own
    // docs say is "not intended for use in production", and it is the single
    // clearest tell to a reviewer that an app is just a wrapped website.
    androidScheme: "https",
  },
};

export default config;
