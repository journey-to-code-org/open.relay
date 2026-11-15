// Neither package may use the TC39 Signals proposal (Stage 1; its reference polyfill says not to use it in
// production), or a library built on it (Zubra's runtime is). Nothing here needs one; this keeps it so.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packages = resolve(import.meta.dirname, "../..");

const banned: [string, RegExp][] = [
  ["the signal-polyfill package", /signal-polyfill/],
  ["Zubra's runtime", /@zubra\//],
  ["@lit-labs/signals", /@lit-labs\/signals/],
  ["the TC39 proposal repository", /proposal-signals|tc39\/proposal-signals/],
  ["Signal.State, Signal.Computed or Signal.subtle", /\bSignal\.(State|Computed|subtle)\b/],
  ["globalThis.Signal", /globalThis\.Signal\b/],
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("the Signals API", () => {
  for (const pkg of readdirSync(packages).filter((n) => statSync(join(packages, n)).isDirectory() && n !== "node_modules")) {
    const manifest = join(packages, pkg, "package.json");
    const sources = files(join(packages, pkg, "src"));

    it(`is not used by packages/${pkg}`, () => {
      const found: string[] = [];
      for (const path of [manifest, ...sources]) {
        const text = readFileSync(path, "utf8");
        for (const [what, pattern] of banned) if (pattern.test(text)) found.push(`${path.slice(packages.length + 1)}: ${what}`);
      }
      expect(found, "see docs/signals.md before changing this").toEqual([]);
    });
  }

  it("does not mistake AbortSignal for it", () => {
    expect(banned.some(([, pattern]) => pattern.test("AbortSignal.timeout(15_000)"))).toBe(false);
  });
});
