import { describe, expect, it } from "vitest";
import { createRelay, plain, type RelayOptions } from "../src/server.js";
import { memoryStore } from "../src/store.js";
import { LIMITS } from "../src/types.js";

const BASE = "https://app.test";

/** A tiny real JPEG header and some bytes: enough to be taken for a picture. */
const jpeg = (size = 64) => `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size, 7)]).toString("base64")}`;

function setup(options: RelayOptions = {}) {
  /** What GitHub was asked, newest last. */
  const asked: { url: string; headers: Record<string, string>; body: { title: string; body: string; labels: string[] } }[] = [];
  let github: () => Response = () => new Response(JSON.stringify({ number: 40 + asked.length, html_url: `https://github.com/o/r/issues/${40 + asked.length}` }), { status: 201 });
  const fetch = (async (url: string, init: RequestInit) => {
    asked.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    return github();
  }) as unknown as typeof globalThis.fetch;
  const store = memoryStore();
  const relay = createRelay({
    token: "ghp_secret",
    repo: "o/r",
    version: "abc1234",
    userNoun: "player",
    store,
    // A person is whoever the "x-user" header says.
    identify: (request) => request.headers.get("x-user") ?? undefined,
    fetch,
    ...options,
  });
  /** One person's way of calling the relay. */
  const person = (name = "anna") => async (path: string, body?: unknown) => {
    const r = (await relay.fetch(new Request(BASE + path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", "x-user": name }, body: body ? JSON.stringify(body) : undefined })))!;
    const type = r.headers.get("content-type");
    return { status: r.status, type, body: type === "application/json" ? await r.json() : Buffer.from(await r.arrayBuffer()) };
  };
  return { relay, store, person, asked, failGitHub: (status = 500) => (github = () => new Response("no", { status })) };
}

describe("reporting a problem", () => {
  it("is off, and says so, until the server has a token", async () => {
    const { person, asked } = setup({ token: "" });
    const me = person();
    expect((await me("/relay/config")).body).toEqual({ enabled: false, tidy: false });
    expect((await me("/relay", { description: "Hello" })).status).toBe(503);
    expect(asked).toEqual([]);
  });

  it("insists on a repository when there is a token", () => {
    expect(() => createRelay({ token: "ghp_secret" })).toThrow(/owner\/name/);
    expect(() => createRelay({ token: "ghp_secret", repo: "not a repo" })).toThrow(/owner\/name/);
  });

  it("ignores any other path", async () => {
    const { relay } = setup();
    expect(await relay.fetch(new Request(`${BASE}/something-else`))).toBeNull();
    expect(await relay.fetch(new Request(`${BASE}/relayed`))).toBeNull();
  });

  it("opens an issue from a person's words, and tells them its number", async () => {
    const { person, asked } = setup();
    const me = person();
    expect((await me("/relay/config")).body).toEqual({ enabled: true, tidy: false });
    const sent = await me("/relay", { description: "The cards overlap on my phone.\nI couldn't tap the ace.", screen: "table", scope: "spades", built: "2026-11-14T09:00Z" });
    expect(sent).toMatchObject({ status: 201, body: { ok: true, number: 41, url: "https://github.com/o/r/issues/41" } });

    const [issue] = asked;
    expect(issue!.url).toBe("https://api.github.com/repos/o/r/issues");
    expect(issue!.headers.authorization).toBe("Bearer ghp_secret");
    expect(issue!.body.title).toBe("The cards overlap on my phone.");
    expect(issue!.body.labels).toEqual(["bug", "player report"]);
    expect(issue!.body.body).toContain("> The cards overlap on my phone.\n> I couldn't tap the ace.");
    expect(issue!.body.body).toContain("| Where | table (spades) |");
    expect(issue!.body.body).toContain("`abc1234`");
    expect(issue!.body.body).toContain("No screenshot.");
    expect(issue!.body.body).toContain("chose not to share browser details");
    expect(issue!.body.body).toContain("Sent from inside the app with “Report a problem”");
    // The token is the server's alone.
    expect(JSON.stringify(sent.body)).not.toContain("ghp_secret");
  });

  it("uses the names it is given", async () => {
    const { person, asked } = setup({ appName: "open.parlor", userNoun: "player", actions: { report: "Report a problem" }, labels: { bug: ["bug", "player report"] }, mount: "/bugs" });
    await person()("/bugs", { description: "Stuck" });
    expect(asked[0]!.body.body).toContain("Sent from inside open.parlor with “Report a problem”");
    expect(asked[0]!.body.labels).toEqual(["bug", "player report"]);
  });

  it("needs no description at all", async () => {
    const { person, asked } = setup();
    expect((await person()("/relay", { screen: "lobby" })).status).toBe(201);
    expect(asked[0]!.body.title).toBe("Problem reported on lobby");
    expect(asked[0]!.body.body).toContain("didn't add a description");
  });

  it("can't be used to mention people, link issues or break out of the report", async () => {
    const { person, asked } = setup();
    await person()("/relay", {
      description: "@octocat look at #1 <img src=x> [click](http://evil.test) ```",
      errors: ["TypeError: x is undefined\n```\n@octocat ![](http://evil.test/a.png)"],
      browser: { userAgent: "Mozilla ``` @octocat", viewport: "390×844", sneaky: "ignored" },
    });
    const { title, body } = asked[0]!.body;
    expect(title).not.toMatch(/@octocat/);
    const quoted = body.split("\n").find((l) => l.startsWith("> "))!;
    expect(quoted).toBe("> @​octocat look at \\#1 \\<img src=x\\> \\[click\\](http://evil.test) \\`\\`\\`");
    // What the page logged sits in code blocks that its own backticks can't close.
    expect(body).toContain("````\nTypeError: x is undefined\n```\n@octocat ![](http://evil.test/a.png)\n````");
    expect(body).toContain("````\nBrowser: Mozilla ``` @octocat\nWindow: 390×844\n````");
    expect(body).not.toContain("ignored");
    expect(plain("a_b*c")).toBe("a\\_b\\*c");
  });

  it("keeps an agreed screenshot and links the issue to it", async () => {
    const { person, asked, store } = setup();
    const me = person();
    const picture = jpeg();
    expect((await me("/relay", { description: "Look", screenshot: picture })).status).toBe(201);
    const link = asked[0]!.body.body.match(/!\[What the player saw\]\((https:\/\/app\.test\/relay\/shots\/[a-z0-9]{20}\.jpg)\)/)?.[1];
    expect(link).toBeTruthy();
    const shown = await me(link!.replace(BASE, ""));
    expect(shown).toMatchObject({ status: 200, type: "image/jpeg" });
    expect((shown.body as Buffer).toString("base64")).toBe(picture.split(",")[1]);
    expect((await me("/relay/shots/aaaaaaaaaaaaaaaaaaaa.jpg")).status).toBe(404);

    // Only a JPEG that fits is taken; anything else is refused before GitHub hears of it.
    expect((await me("/relay", { screenshot: "data:image/svg+xml;base64,PHN2Zz4=" })).status).toBe(400);
    expect((await me("/relay", { screenshot: `data:image/jpeg;base64,${Buffer.from("<html>").toString("base64")}` })).status).toBe(400);
    expect((await me("/relay", { screenshot: jpeg(LIMITS.shot) })).status).toBe(400);
    expect(asked).toHaveLength(1);
    expect(Object.values((await store.read("shots")) ?? {}).filter(Boolean)).toHaveLength(1);
  });

  it("keeps only the newest screenshots", async () => {
    let at = 1_000;
    const { person, store } = setup({ each: 1000, daily: 1000, now: () => (at += 10) });
    const me = person();
    for (let i = 0; i < 33; i++) await me("/relay", { description: "x", screenshot: jpeg(8) });
    const kept = Object.entries((await store.read("shots")) ?? {}).filter(([, v]) => typeof v === "number");
    expect(kept).toHaveLength(30);
  });

  it("describes a ref through enrich, and keeps it beside the issue, never in it", async () => {
    const seen: unknown[] = [];
    const { person, asked, store } = setup({
      enrichTitle: "The table",
      enrich: (context) => {
        seen.push(context);
        return context.ref === "t-1" ? ["Game: Gin Rummy", "Seats: 2 (2 people, 0 computer, 0 empty)"] : null;
      },
    });
    const me = person();
    const sent = await me("/relay", { description: "Stuck", screen: "table", scope: "gin", ref: "t-1" });
    const { body } = asked[0]!.body;
    expect(seen).toEqual([{ ref: "t-1", screen: "table", scope: "gin" }]);
    expect(body).toContain("<summary>The table</summary>\n\n```\nGame: Gin Rummy\nSeats: 2 (2 people, 0 computer, 0 empty)\n```");
    expect(body).not.toContain("t-1");
    // Whoever runs the server can still find it.
    expect(await store.read("reports")).toMatchObject({ [`n${sent.body.number}`]: { ref: "t-1" } });
    // A ref enrich can't describe adds nothing to the issue, but is still kept.
    await me("/relay", { description: "Again", ref: "t-gone" });
    expect(asked[1]!.body.body).not.toContain("<summary>The table</summary>");
  });

  it("says so when GitHub can't be reached, and keeps nothing", async () => {
    const { person, failGitHub, store } = setup();
    failGitHub(401);
    const sent = await person()("/relay", { description: "Oh no", screenshot: jpeg() });
    expect(sent).toMatchObject({ status: 502, body: { error: expect.stringContaining("couldn't be sent") } });
    expect(Object.values((await store.read("shots")) ?? {}).filter(Boolean)).toEqual([]);
  });

  it("takes only a few from one person, and a day's worth from everyone", async () => {
    let at = 1_000_000;
    const { person, asked } = setup({ each: 2, daily: 3, now: () => at });
    const me = person();
    expect((await me("/relay", { description: "one" })).status).toBe(201);
    expect((await me("/relay", { description: "two" })).status).toBe(201);
    expect(await me("/relay", { description: "three" })).toMatchObject({ status: 429, body: { error: expect.stringContaining("ten minutes") } });
    // Someone else has their own few.
    expect((await person("ben")("/relay", { description: "three" })).status).toBe(201);
    at += 11 * 60_000;
    expect(await me("/relay", { description: "four" })).toMatchObject({ status: 429, body: { error: expect.stringContaining("tomorrow") } });
    expect(asked).toHaveLength(3);
  });

  it("tells people apart by address when it isn't told who they are", async () => {
    const { relay, asked } = setup({ identify: undefined, each: 1 });
    const from = (ip: string) => relay.fetch(new Request(BASE + "/relay", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ description: "hi" }) }));
    expect((await from("10.0.0.1"))!.status).toBe(201);
    expect((await from("10.0.0.1"))!.status).toBe(429);
    expect((await from("10.0.0.2"))!.status).toBe(201);
    expect(asked).toHaveLength(2);
  });

  it("serves Node's http, and turns away a body that is too big", async () => {
    const { relay, asked } = setup({ reportLimit: 200 });
    const { Readable } = await import("node:stream");
    const call = async (method: string, url: string, body = "") => {
      const req = Object.assign(Readable.from(body ? [Buffer.from(body)] : []), { method, url, headers: { "content-type": "application/json", host: "app.test", "x-user": "anna" } });
      let status = 0;
      let text = "";
      const res = { writeHead: (s: number) => void (status = s), end: (t: string | Buffer) => void (text = String(t)) };
      const handled = await relay.handle(req as never, res as never);
      return { handled, status, text };
    };
    expect(await call("GET", "/elsewhere")).toMatchObject({ handled: false });
    expect(await call("POST", "/relay", JSON.stringify({ description: "hello" }))).toMatchObject({ handled: true, status: 201 });
    expect(await call("POST", "/relay", JSON.stringify({ description: "x".repeat(400) }))).toMatchObject({ handled: true, status: 413 });
    expect(asked).toHaveLength(1);
  });
});

describe("making a request", () => {
  /** A GitHub that remembers the issues it was given. */
  function github(options: RelayOptions = {}) {
    const issues: { number: number; title: string; body: string; labels: string[]; html_url: string }[] = [];
    const comments: { issue: number; body: string }[] = [];
    const fetch = (async (url: string, init: RequestInit) => {
      const path = url.replace("https://api.github.com/repos/o/r", "");
      const sent = init.body ? JSON.parse(String(init.body)) : null;
      if (init.method === "GET" && path.startsWith("/issues?")) {
        expect(path).toContain("labels=game%20request");
        return new Response(JSON.stringify(issues.filter((i) => i.labels.includes("game request"))));
      }
      const comment = path.match(/^\/issues\/(\d+)\/comments$/);
      if (comment) return comments.push({ issue: Number(comment[1]), body: sent.body }), new Response(JSON.stringify({ id: comments.length }), { status: 201 });
      const issue = { number: 7 + issues.length, html_url: `https://github.com/o/r/issues/${7 + issues.length}`, ...sent };
      issues.push(issue);
      return new Response(JSON.stringify(issue), { status: 201 });
    }) as unknown as typeof globalThis.fetch;
    const { relay } = setup({ fetch, labels: { request: ["enhancement", "game request"] }, requestTitle: "Game request", actions: { request: "Ask for a game" }, ...options });
    const ask = async (body: unknown, who = `10.0.0.${issues.length + comments.length}`) => {
      const r = (await relay.fetch(new Request(BASE + "/relay/request", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": who }, body: JSON.stringify(body) })))!;
      return { status: r.status, body: await r.json() };
    };
    return { ask, issues, comments };
  }

  it("opens an issue for something nobody has asked for", async () => {
    const { ask, issues } = github({ identify: undefined });
    expect(await ask({ name: "Mah-Jongg", note: "The way @grandma plays it, with jokers" })).toEqual({ status: 201, body: { ok: true, number: 7, url: "https://github.com/o/r/issues/7", again: false } });
    expect(issues[0]).toMatchObject({ title: "Game request: Mah-Jongg", labels: ["enhancement", "game request"] });
    expect(issues[0]!.body).toContain("A player asked for **Mah-Jongg**.");
    expect(issues[0]!.body).toContain("> The way @​grandma plays it, with jokers");
    expect(issues[0]!.body).toContain("with “Ask for a game”");
  });

  it("adds a voice to the open request for the same name", async () => {
    const { ask, issues, comments } = github({ identify: undefined });
    await ask({ name: "Mah-Jongg" });
    expect(await ask({ name: "  mah jongg! ", note: "Yes please" })).toMatchObject({ status: 201, body: { number: 7, again: true } });
    await ask({ name: "Backgammon" });
    expect(issues.map((i) => i.title)).toEqual(["Game request: Mah-Jongg", "Game request: Backgammon"]);
    expect(comments).toEqual([{ issue: 7, body: expect.stringMatching(/^Another player asked for this\.\n\n> Yes please/) }]);
  });

  it("keeps what the person first wrote when they send a tidied version", async () => {
    const { ask, issues } = github({ identify: undefined });
    await ask({ name: "Mahjong", note: "Hong Kong style.", original: { name: "mah jong", note: "hk style" } });
    expect(issues[0]!.body).toContain("<summary>The player's own words</summary>\n\nRequest: mah jong\n\n> hk style");
    expect(issues[0]!.body).toContain("Tidied with AI");
  });

  it("needs a name, a token, and not too many at once", async () => {
    const { ask, issues } = github({ each: 1, identify: undefined });
    expect((await ask({ name: " ! " })).status).toBe(400);
    expect((await github({ token: "", identify: undefined }).ask({ name: "Chess" })).status).toBe(503);
    expect(issues).toEqual([]);
    const one = github({ each: 1, daily: 1, identify: undefined });
    expect((await one.ask({ name: "Chess" }, "10.1.1.1")).status).toBe(201);
    expect(await one.ask({ name: "Go" }, "10.1.1.2")).toMatchObject({ status: 429, body: { error: expect.stringContaining("tomorrow") } });
  });

  it("defaults to a feature request", async () => {
    const asked: { title: string; labels: string[] }[] = [];
    const fetch = (async (_url: string, init: RequestInit) => {
      if (init.method === "GET") return new Response("[]");
      asked.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ number: 1 }), { status: 201 });
    }) as unknown as typeof globalThis.fetch;
    const relay = createRelay({ token: "t", repo: "o/r", fetch });
    await relay.fetch(new Request(BASE + "/relay/request", { method: "POST", body: JSON.stringify({ name: "Dark mode" }) }));
    expect(asked[0]).toMatchObject({ title: "Feature request: Dark mode", labels: ["enhancement", "feature request"] });
  });
});

describe("tidying before sending", () => {
  const tidied = { kind: "bug" as const, title: "Palace: can draw before playing on a 10", report: "- After a 10 or a 2, the player draws before playing on top.\n- Toggles look broken." };
  const tidy = async (input: { kind: string }) => (input.kind === "bug" ? tidied : { kind: "request" as const, name: "Mahjong", note: "Hong Kong style, four players." });

  it("tidies a report for the person to look over, and sends nothing", async () => {
    const { person, asked } = setup({ tidy });
    const me = person();
    expect((await me("/relay/config")).body).toEqual({ enabled: true, tidy: true });
    const answer = await me("/relay/tidy", { kind: "bug", description: "in palace you can draw after a 10, and the toggles are broken", screen: "table", scope: "palace" });
    expect(answer).toMatchObject({ status: 200, body: tidied });
    expect((await me("/relay/tidy", { kind: "request", name: "mah jong", note: "hk style" })).body).toMatchObject({ name: "Mahjong" });
    expect(asked).toEqual([]);
    expect((await me("/relay/tidy", { kind: "bug", description: "broken" })).status).toBe(400);
  });

  it("is off without a tidy, says so when it fails, and takes only so many", async () => {
    expect((await setup().person()("/relay/tidy", { kind: "bug", description: "The cards overlap on my phone." })).status).toBe(503);
    const failing = setup({ tidy: async () => null }).person();
    expect(await failing("/relay/tidy", { kind: "bug", description: "The cards overlap on my phone." })).toMatchObject({ status: 502, body: { error: expect.stringContaining("own words") } });
    const busy = setup({ tidy, tidies: 1 }).person();
    expect((await busy("/relay/tidy", { kind: "bug", description: "The cards overlap on my phone." })).status).toBe(200);
    expect((await busy("/relay/tidy", { kind: "bug", description: "The cards overlap on my phone." })).status).toBe(429);
  });

  it("sends the person's chosen title and words, with what they first wrote folded away", async () => {
    const { person, asked } = setup({ tidy });
    const me = person();
    await me("/relay", { title: "Palace: @someone #12 draws early", description: tidied.report, original: "in palace you can draw after a 10" });
    const issue = asked[0]!.body;
    expect(issue.title).toBe("Palace: @​someone \\#12 draws early");
    expect(issue.body.startsWith("> - After a 10 or a 2")).toBe(true);
    expect(issue.body).toContain("<summary>The player's own words</summary>\n\n> in palace you can draw after a 10");
    expect(issue.body).toContain("Tidied with AI");
    // Put back to their own words: nothing extra.
    await me("/relay", { description: "The cards overlap.", original: "The cards overlap." });
    expect(asked[1]!.body.body).not.toContain("own words");
    expect(asked[1]!.body.body).not.toContain("Tidied");
  });
});
