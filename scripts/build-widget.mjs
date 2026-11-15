// Bundles the docs site's "Report a problem" button (docs-site/widget) into one file the pages load.
// The packages are imported from their built output, so run `npm run build` first.
// Usage: node scripts/build-widget.mjs

import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outfile = path.join(repoRoot, "docs-site", "static", "relay-widget.js");

const result = await build({
  entryPoints: [path.join(repoRoot, "docs-site", "widget", "relay-widget.ts")],
  outfile,
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  // The screenshot library is an optional peer. The docs widget leaves screenshots out, so the client's
  // dynamic import of it fails, is caught, and takes none.
  external: ["modern-screenshot"],
  metafile: true,
  logLevel: "warning",
});
const bytes = Object.values(result.metafile.outputs)[0].bytes;
console.log(`docs-site/static/relay-widget.js: ${(bytes / 1024).toFixed(1)} KiB`);
