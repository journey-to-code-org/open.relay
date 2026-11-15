// The built button, in a fake browser, talking to the real Worker handler with a fake GitHub.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { beforeAll, describe, expect, it } from "vitest";
import { handle } from "../src/handler.js";

const PAGES = "https://journey-to-code-org.github.io";
const bundle = new URL("../../../docs-site/static/relay-widget.js", import.meta.url);

describe("the Report a problem button", () => {
  // The bundle imports the packages' built output, so `npm run build` comes first (CI does that).
  beforeAll(() => void execFileSync("node", [new URL("../../../scripts/build-widget.mjs", import.meta.url).pathname], { stdio: "pipe" }));

  it("opens, sends, and files a demo issue", async () => {
    const issues: { labels: string[]; body: string }[] = [];
    const github: typeof fetch = async (url, init) => {
      if (init?.method === "POST") {
        issues.push(JSON.parse(String(init.body)));
        return Response.json({ number: 7, html_url: "https://github.com/x/y/issues/7" }, { status: 201 });
      }
      return Response.json([]);
    };
    const env = { GITHUB_TOKEN: "t", REPO: "journey-to-code-org/open.relay", ALLOWED_ORIGINS: PAGES };
    const worker: typeof fetch = (input, init) => handle(new Request(input as string, { ...init, headers: { ...(init?.headers as object), origin: PAGES } }), env, { fetch: github });

    const window = new Window({ url: `${PAGES}/open.relay/docs/`, settings: { disableJavaScriptFileLoading: true } });
    const document = window.document as unknown as Document;
    const code = readFileSync(bundle, "utf8");
    const g = globalThis as Record<string, unknown>;
    const extra = ['innerWidth','innerHeight','devicePixelRatio','screen','navigator','matchMedia','scrollX','scrollY','getComputedStyle','Element'] as const;
    const savedExtra = extra.map((k) => [k, Object.getOwnPropertyDescriptor(g, k)] as const);
    const saved = { fetch: g.fetch, document: g.document, window: g.window, location: g.location, addEventListener: g.addEventListener, HTMLTextAreaElement: g.HTMLTextAreaElement };
    try {
      Object.assign(g, { fetch: (u: string, i?: RequestInit) => worker(`https://worker.test${new URL(u).pathname}`, i), document, window, location: window.location, addEventListener: window.addEventListener.bind(window), HTMLTextAreaElement: window.HTMLTextAreaElement });
      for (const k of extra) Object.defineProperty(g, k, { value: (window as unknown as Record<string, unknown>)[k], configurable: true, writable: true });
      // happy-dom has no <dialog>.showModal in every version; give it a minimal one.
      const proto = window.HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void };
      proto.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
      proto.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

      const script = document.createElement("script");
      script.setAttribute("data-relay", "https://worker.test/relay");
      document.body.append(script);
      Object.defineProperty(document, "currentScript", { value: script });
      // The widget finds its own tag by attribute, so evaluating the bundle in this scope is enough.
      await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
      await new Promise((r) => setTimeout(r, 50));

      const button = document.querySelector<HTMLButtonElement>(".relay-demo-button")!;
      expect(button).not.toBeNull();
      expect(button.hidden).toBe(false);
      button.click();
      await new Promise((r) => setTimeout(r, 20));
      const sheet = document.querySelector(".relay-demo-sheet")!;
      expect(sheet.textContent).toContain("labelled");
      const words = sheet.querySelector("textarea")!;
      words.value = "The sample on the client page is cut off on a phone";
      words.dispatchEvent(new window.Event("input", { bubbles: true }) as unknown as Event);
      ([...sheet.querySelectorAll("button")] as unknown as HTMLButtonElement[]).find((b) => b.textContent === "Send")!.click();
      await new Promise((r) => setTimeout(r, 100));
      expect(issues).toHaveLength(1);
      expect(issues[0]!.labels).toEqual(["demo", "demo report"]);
      expect(sheet.textContent).toContain("#7");
      expect(sheet.textContent).toContain("not a real report");
    } finally {
      Object.assign(g, saved);
      for (const [k, d] of savedExtra) d ? Object.defineProperty(g, k, d) : delete g[k];
    }
  });
});
