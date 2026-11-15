import { describe, expect, it } from "vitest";
import { browserLines, createRelayClient } from "../src/client.js";

/** A server that answers what it is told to, and remembers what it was asked. */
function server(answers: Record<string, { status?: number; body: unknown } | Error>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const answer = answers[`${init?.method ?? "GET"} ${url}`];
    if (!answer) return new Response("{}", { status: 404 });
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}
const browser = { userAgent: "UA", platform: "P", viewport: "1×1", screen: "2×2", language: "en", installed: false, touch: true, online: true, reducedMotion: false };

describe("the client", () => {
  it("asks once whether reporting and tidying are on", async () => {
    const { fetch, calls } = server({ "GET /relay/config": { body: { enabled: true, tidy: true } } });
    const client = createRelayClient({ fetch });
    expect(await client.enabled()).toBe(true);
    expect(await client.canTidy()).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("is off, quietly, when there is no server to ask", async () => {
    const client = createRelayClient({ fetch: server({ "GET /relay/config": new Error("offline") }).fetch });
    expect(await client.enabled()).toBe(false);
    expect(await client.canTidy()).toBe(false);
    // Tidying needs reporting.
    expect(await createRelayClient({ fetch: server({ "GET /relay/config": { body: { enabled: false, tidy: true } } }).fetch }).canTidy()).toBe(false);
  });

  it("sends a report with where the person was, the build and the errors the page logged", async () => {
    const { fetch, calls } = server({ "POST /bugs": { status: 201, body: { ok: true, number: 5, url: "https://github.com/o/r/issues/5" } } });
    const client = createRelayClient({ fetch, base: "/bugs/", built: "2026-11-15" });
    client.setContext({ screen: "table", scope: "gin", ref: "t-1" });
    client.noteError("error", new Error("boom"));
    expect(await client.send({ description: "Stuck", screenshot: null, browser: null })).toEqual({ number: 5, url: "https://github.com/o/r/issues/5" });
    expect(JSON.parse(String(calls[0]!.init!.body))).toMatchObject({ description: "Stuck", screen: "table", scope: "gin", ref: "t-1", built: "2026-11-15", errors: [expect.stringContaining("error: ")] });
  });

  it("keeps only the last few errors", async () => {
    const { fetch, calls } = server({ "POST /relay": { status: 201, body: { number: 1 } } });
    const client = createRelayClient({ fetch });
    for (let i = 0; i < 14; i++) client.noteError("error", `problem ${i}`);
    await client.send({ description: "", screenshot: null, browser: null });
    const errors = JSON.parse(String(calls[0]!.init!.body)).errors as string[];
    expect(errors).toHaveLength(10);
    expect(errors[0]).toContain("problem 4");
  });

  it("throws words for the person: the server's own, or ours", async () => {
    const refused = createRelayClient({ fetch: server({ "POST /relay": { status: 429, body: { error: "Give it ten minutes." } } }).fetch });
    await expect(refused.send({ description: "", screenshot: null, browser: null })).rejects.toThrow("Give it ten minutes.");
    const down = createRelayClient({ fetch: server({ "POST /relay": new Error("offline") }).fetch });
    await expect(down.send({ description: "", screenshot: null, browser: null })).rejects.toThrow(/Check your connection/);
    const odd = createRelayClient({ fetch: server({ "POST /relay": { status: 200, body: {} } }).fetch });
    await expect(odd.send({ description: "", screenshot: null, browser: null })).rejects.toThrow(/couldn't be sent/);
  });

  it("makes a request, and says whether it was added to one already open", async () => {
    const { fetch, calls } = server({ "POST /relay/request": { status: 201, body: { ok: true, number: 9, url: "u", again: true } } });
    const client = createRelayClient({ fetch });
    expect(await client.request("Mahjong", "note", { name: "mah jong", note: "n" })).toEqual({ number: 9, url: "u", again: true });
    expect(JSON.parse(String(calls[0]!.init!.body))).toEqual({ name: "Mahjong", note: "note", original: { name: "mah jong", note: "n" } });
  });

  it("tidies, and refuses an answer of the wrong kind", async () => {
    const { fetch, calls } = server({ "POST /relay/tidy": { body: { kind: "bug", title: "T", report: "R" } } });
    const client = createRelayClient({ fetch });
    client.setContext({ screen: "table", scope: "gin" });
    expect(await client.tidy({ kind: "bug", description: "the cards overlap" })).toEqual({ kind: "bug", title: "T", report: "R" });
    expect(JSON.parse(String(calls[0]!.init!.body))).toMatchObject({ screen: "table", scope: "gin" });
    await expect(client.tidy({ kind: "request", name: "x", note: "" })).rejects.toThrow(/couldn't be tidied/);
  });

  it("lists the browser details a person is shown", () => {
    expect(browserLines(browser)).toEqual([
      ["Browser", "UA"],
      ["Device", "P"],
      ["Window", "1×1"],
      ["Screen", "2×2"],
      ["Language", "en"],
      ["Installed as an app", "no"],
      ["Touch screen", "yes"],
    ]);
  });
});
