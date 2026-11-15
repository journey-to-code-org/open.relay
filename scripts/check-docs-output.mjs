// Fails if the built documentation site mentions the Signals API or a library built on it.
// docs/signals.md promises there is none; this keeps the promise true of the published pages.
//
// Usage: node scripts/check-docs-output.mjs [dir]   (default: docs-site/dist)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.resolve(process.argv[2] ?? path.join(repoRoot, "docs-site", "dist"));

// The pages that explain the rule may name it; nothing else may carry it.
const explains = new Set(["docs/signals/index.html", "docs/index.html", "docs/agents/index.html"]);
const banned = [
  /signal-polyfill/,
  /@zubra\//,
  /@lit-labs\/signals/,
  /\bSignal\.(State|Computed|subtle)\b/,
  /globalThis\.Signal\b/,
  /zubra/i,
];

if (!fs.existsSync(dir)) {
  console.error(`check-docs-output: ${dir} does not exist; build the site first`);
  process.exit(1);
}

const found = [];
let checked = 0;
for (const name of fs.readdirSync(dir, { recursive: true })) {
  const rel = String(name).split(path.sep).join("/");
  const file = path.join(dir, rel);
  if (!fs.statSync(file).isFile() || !/\.(html|js|mjs|css|json|xml|txt|md)$/.test(rel)) continue;
  checked++;
  const text = fs.readFileSync(file, "utf8");
  const isPageAboutIt = explains.has(rel);
  for (const pattern of banned) {
    if (!pattern.test(text)) continue;
    if (isPageAboutIt && !/\.(js|mjs)$/.test(rel)) continue;
    found.push(`${rel}: ${pattern}`);
  }
}

if (found.length) {
  console.error("check-docs-output: the built site mentions the Signals API or a library built on it:");
  for (const line of found) console.error(`  ${line}`);
  console.error("See docs/signals.md.");
  process.exit(1);
}
console.log(`check-docs-output: ${checked} files in ${path.relative(repoRoot, dir) || "."}, no Signals API`);
