import { describe, expect, it } from "vitest";
import { handle, type Env } from "../src/handler.js";

const PAGES = "https://journey-to-code-org.github.io";
const env = (extra: Partial<Env> = {}): Env => ({ GITHUB_TOKEN: "t", REPO: "journey-to-code-org/open.relay", ALLOWED_ORIGINS: `${PAGES}, http://localhost:8080`, ...extra });

/** A GitHub that records the issues it is asked to open. */
function github() {
  const issues: { title: string; body: string; labels: string[] }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (init?.method === "POST" && path.endsWith("/issues")) {
      const issue = JSON.parse(String(init.body));
      issues.push(issue);
      return Response.json({ number: issues.length, html_url: `https://github.com/journey-to-code-org/open.relay/issues/${issues.length}` }, { status: 201 });
    }
    return Response.json([]);
  };
  return { issues, fetcher };
}

const post = (path: string, body: unknown, origin = PAGES) =>
  new Request(`https://relay.example.workers.dev${path}`, { method: "POST", headers: { "content-type": "application/json", origin, "cf-connecting-ip": "203.0.113.7" }, body: JSON.stringify(body) });

describe("the docs Worker", () => {
  it("answers a preflight for the docs site, and only for it", async () => {
    const ok = await handle(new Request("https://r.example/relay", { method: "OPTIONS", headers: { origin: PAGES } }), env());
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe(PAGES);
    expect(ok.headers.get("access-control-allow-methods")).toContain("POST");
    expect(ok.headers.get("access-control-allow-headers")).toContain("content-type");

    const other = await handle(new Request("https://r.example/relay", { method: "OPTIONS", headers: { origin: "https://evil.example" } }), env());
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("says the relay is on, with CORS, to the docs site", async () => {
    const response = await handle(new Request("https://r.example/relay/config", { headers: { origin: PAGES } }), env());
    expect(await response.json()).toEqual({ enabled: true, tidy: false });
    expect(response.headers.get("access-control-allow-origin")).toBe(PAGES);
  });

  it("is off without a token", async () => {
    const response = await handle(new Request("https://r.example/relay/config", { headers: { origin: PAGES } }), env({ GITHUB_TOKEN: undefined }));
    expect(await response.json()).toEqual({ enabled: false, tidy: false });
  });

  it("files a report as a demo: labelled, and saying so", async () => {
    const { issues, fetcher } = github();
    const response = await handle(post("/relay", { description: "The code sample on this page is cut off on my phone", screen: "/docs/client/" }), env(), { fetch: fetcher });
    expect(response.status).toBe(201);
    expect(response.headers.get("access-control-allow-origin")).toBe(PAGES);
    expect((await response.json()) as { number: number }).toMatchObject({ number: 1 });
    expect(issues[0]!.labels).toEqual(["demo", "demo report"]);
    expect(issues[0]!.body).toContain("as a demo");
    expect(issues[0]!.body).toContain("/docs/client/");
  });

  it("files a request as a demo too", async () => {
    const { issues, fetcher } = github();
    const response = await handle(post("/relay/request", { name: "A Vue example", note: "Like the React one" }), env(), { fetch: fetcher });
    expect(response.status).toBe(201);
    expect(issues[0]!.title).toBe("Demo request: A Vue example");
    expect(issues[0]!.labels).toEqual(["demo", "demo request"]);
  });

  it("limits one person, by Cloudflare's address, across requests", async () => {
    const { fetcher } = github();
    const e = env();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await handle(post("/relay", { description: `Something is wrong with page ${i}, really` }), e, { fetch: fetcher })).status);
    expect(statuses).toEqual([201, 201, 201, 429]);
  });

  it("leaves other paths alone", async () => {
    expect((await handle(new Request("https://r.example/other"), env())).status).toBe(404);
  });
});
