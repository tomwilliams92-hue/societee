/* Stamps the build so a running PWA can tell a new deploy has landed.
 * Writes the same id to public/version.txt (served, polled by VersionWatch)
 * and lib/build-id.ts (baked into the bundle). Run before `next build`. */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const id = new Date().toISOString().replace(/[:.]/g, "-");

writeFileSync(join(root, "public", "version.txt"), id + "\n");
writeFileSync(
  join(root, "lib", "build-id.ts"),
  `/** Overwritten by scripts/stamp-version.mjs at every build — see VersionWatch. */\nexport const BUILD_ID = "${id}";\n`
);
console.log("build stamped:", id);
