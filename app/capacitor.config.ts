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
    contentInset: "always",
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
