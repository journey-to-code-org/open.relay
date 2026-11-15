// "Report a problem" and "Make a request": someone says what went wrong (or what they'd like) from
// inside your app, and this server opens an issue for it on GitHub. Nobody needs a GitHub account: the
// server has a token that may open issues on one repository, and that token never leaves it.
//
// The issue is public, so it is built from as little as explains the problem: the person's own words,
// where they were (which screen, which scope), what the page had logged going wrong, and, only when
// they agreed to each, a picture of their screen and their browser's details. Never their name, their
// cookie, or anything your `enrich` hook doesn't choose to say. The `ref` they were looking at stays
// here, beside the issue's number, for whoever runs the server.
//
// A request (a name and a note) becomes an issue with a request label, or a comment on the open
// request for the same name, so an issue's comments count how many people want it.
//
// Before either is sent, `tidy` (when you give one) can rewrite it: a clear title and a concise report,
// or a request's proper name and a short note. The page shows the person the tidied version to keep,
// change, put back to their own words, or turn down; nothing is sent until they say so. When a tidied
// version goes, their own words go with it, folded away.
//
// GitHub's API can't take a picture with an issue, so a screenshot is kept in the store and the issue
// links to it. Only the newest few are kept.
//
//   shot-<id>   one screenshot (served at <mount>/shots/<id>.jpg)
//   shots       when each was taken, for dropping the oldest
//   reports     issue number → the ref it was sent from
import type { IncomingMessage, ServerResponse } from "node:http";
import { memoryStore, type RelayStore } from "./store.js";
import { details, fence, line, lines, plain, quote, sameName } from "./text.js";
import { LIMITS, type Tidied, type TidyInput } from "./types.js";

export interface RelayOptions {
  /** A GitHub token that may open issues on `repo`. Without one, reporting is off. */
  token?: string;
  /** Where issues are filed, as "owner/name". Required with a token. */
  repo?: string;
  /** What's deployed (a commit), for the issue. */
  version?: string;
  /** What your app calls itself in the line at the foot of each issue. Default "the app". */
  appName?: string;
  /** What you call the people who use it. Default "user". */
  userNoun?: string;
  /** The words for the two actions, as the footer of each issue names them. */
  actions?: { report?: string; request?: string };
  /** Labels for a bug and for a request. The last label of a request is the one it is looked up by. Defaults: ["bug", "<user> report"] and ["enhancement", "feature request"]. */
  labels?: { bug?: string[]; request?: string[] };
  /** The start of a request's title, before its name. Default "Feature request". */
  requestTitle?: string;
  /** Where the routes live. Default "/relay". */
  mount?: string;
  /** Where screenshots and which ref each issue came from are kept. Default: memory. */
  store?: RelayStore;
  /** Who is asking, for the limits below: a signed-in user, a cookie. Default: the address it came from. */
  identify?: (request: Request) => string | undefined | Promise<string | undefined>;
  /** Describes a `ref` (a table, an order) in lines for the issue; never who is involved. Null when it can't. */
  enrich?: (context: { ref: string; screen: string; scope: string }, request: Request) => Promise<string[] | null | undefined> | string[] | null | undefined;
  /** What the enriched lines are called in the issue. Default "Context". */
  enrichTitle?: string;
  /** Tidies a report or request (see `createTidy`); leave it out to turn tidying off. */
  tidy?: (input: TidyInput) => Promise<Tidied | null>;
  /** Reports one person may send in ten minutes, and everyone together in a day. */
  each?: number;
  daily?: number;
  /** Tidy-ups one person may ask for in ten minutes. */
  tidies?: number;
  /** The biggest body read, in bytes. */
  reportLimit?: number;
  /** For tests. */
  fetch?: typeof fetch;
  now?: () => number;
}

const SHOTS_KEPT = 30;
const ERRORS_KEPT = 10;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** The picture in a `data:image/jpeg;base64,…` address, or null if it isn't a JPEG that fits. */
function jpegOf(value: unknown): Buffer | null {
  const match = typeof value === "string" ? value.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/) : null;
  if (!match || match[1]!.length > LIMITS.shot * 1.4) return null;
  const bytes = Buffer.from(match[1]!, "base64");
  const jpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return jpeg && bytes.length <= LIMITS.shot ? bytes : null;
}

/** The browser's details, down to the ones asked for, each cut to size. */
const BROWSER_FIELDS: [string, string][] = [
  ["userAgent", "Browser"],
  ["platform", "Device"],
  ["viewport", "Window"],
  ["screen", "Screen"],
  ["language", "Language"],
  ["installed", "Installed as an app"],
  ["touch", "Touch screen"],
  ["online", "Online"],
  ["reducedMotion", "Prefers reduced motion"],
];
function browserOf(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const given = value as Record<string, unknown>;
  const rows = BROWSER_FIELDS.flatMap(([key, label]) => {
    const v = given[key];
    const text = typeof v === "boolean" ? (v ? "yes" : "no") : line(v, 300);
    return text ? [`${label}: ${text}`] : [];
  });
  return rows.length ? rows.join("\n") : null;
}

/** This server's own address as the person reached it, for the screenshot's link. */
function originOf(request: Request): string {
  const first = (name: string) => (request.headers.get(name) ?? "").split(",")[0]!.trim();
  const host = first("x-forwarded-host") || first("host") || new URL(request.url).host;
  const forwarded = first("x-forwarded-proto");
  const proto = forwarded ? (forwarded === "https" ? "https" : "http") : new URL(request.url).protocol.replace(":", "");
  return /^[a-z0-9.-]+(:\d{1,5})?$/i.test(host) ? `${proto}://${host}` : "";
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const randomId = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => ALPHABET[b % ALPHABET.length]).join("");
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function createRelay(options: RelayOptions = {}) {
  const token = options.token?.trim() ?? "";
  const enabled = token.length > 0;
  const repo = options.repo?.trim() ?? "";
  if (enabled && !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('relay: with a token, `repo` must be "owner/name"');
  const mount = (options.mount ?? "/relay").replace(/\/$/, "");
  const store = options.store ?? memoryStore();
  const send = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const each = options.each ?? 3;
  const daily = options.daily ?? 40;
  const version = line(options.version, 40);
  const app = options.appName ?? "the app";
  const user = options.userNoun ?? "user";
  const reportAction = options.actions?.report ?? "Report a problem";
  const requestAction = options.actions?.request ?? "Make a request";
  const bugLabels = options.labels?.bug ?? ["bug", `${user} report`];
  const requestLabels = options.labels?.request ?? ["enhancement", "feature request"];
  const requestLabel = requestLabels.at(-1) ?? "feature request";
  const requestTitle = options.requestTitle ?? "Feature request";
  const requestPrefix = new RegExp(`^${escapeRegExp(requestTitle)}:`, "i");
  const reportLimit = options.reportLimit ?? LIMITS.report;
  const tidier = enabled ? options.tidy : undefined;
  const tidies = options.tidies ?? 8;
  const tidied = new Map<string, number[]>();

  /** Who is asking, for the limits: whoever `identify` says, else where the request came from. */
  async function whoIs(request: Request): Promise<string> {
    return (await options.identify?.(request)) ?? `ip:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"}`;
  }

  // Anyone can reach this without signing in to anything, and every report becomes a public issue:
  // so a person gets a few, and everyone together gets a day's worth.
  const sent = new Map<string, number[]>();
  let today: number[] = [];
  function tooMany(who: string, noun: "reports" | "requests"): string | null {
    const at = now();
    today = today.filter((t) => at - t < 86_400_000);
    const mine = (sent.get(who) ?? []).filter((t) => at - t < 600_000);
    sent.set(who, mine);
    if (mine.length >= each) return `That's a few ${noun} in a row. Thank you! Give it ten minutes before the next.`;
    if (today.length >= daily) return `There have been a lot of ${noun} today. Try again tomorrow.`;
    return null;
  }
  function count(who: string) {
    const at = now();
    today.push(at);
    sent.set(who, [...(sent.get(who) ?? []), at]);
    // Forget people who haven't reported in a while.
    if (sent.size > 500) for (const [k, times] of sent) if (times.every((t) => at - t >= 600_000)) sent.delete(k);
  }

  /** Keep a screenshot, drop the oldest past the newest few, and answer its id. */
  async function keep(shot: Buffer): Promise<string> {
    const id = randomId(20);
    await store.patch(`shot-${id}`, { jpeg: shot.toString("base64"), at: now() });
    const index = { ...((await store.read("shots")) ?? {}), [id]: now() } as Record<string, unknown>;
    const old = Object.entries(index)
      .filter((e): e is [string, number] => typeof e[1] === "number")
      .sort((a, b) => b[1] - a[1])
      .slice(SHOTS_KEPT)
      .map(([k]) => k);
    for (const k of old) await store.patch(`shot-${k}`, { jpeg: null, at: null });
    await store.patch("shots", { [id]: now(), ...Object.fromEntries(old.map((k) => [k, null])) });
    return id;
  }
  const drop = async (id: string) => {
    await store.patch(`shot-${id}`, { jpeg: null, at: null });
    await store.patch("shots", { [id]: null });
  };

  type Issue = { number?: number; html_url?: string; title?: string; pull_request?: unknown };
  /** Ask GitHub's API about the repository; null when it can't be reached or says no. */
  async function github<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T | null> {
    try {
      const response = await send(`https://api.github.com/repos/${repo}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          "content-type": "application/json",
          "user-agent": "open.relay",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return (await response.json()) as T;
      console.error(`relay: GitHub answered ${response.status} to ${method} ${path} on ${repo}`, (await response.text().catch(() => "")).slice(0, 300));
    } catch (e) {
      console.error("relay: couldn't reach GitHub", e);
    }
    return null;
  }
  const urlOf = (issue: Issue) => issue.html_url ?? `https://github.com/${repo}/issues/${issue.number}`;

  /** POST <mount>/tidy: the person's words, tidied for the developers, for them to look over. */
  async function tidy(request: Request): Promise<Response> {
    if (!tidier) return json({ error: "Tidying isn't on here." }, 503);
    const who = await whoIs(request);
    const at = now();
    const mine = (tidied.get(who) ?? []).filter((t) => at - t < 600_000);
    if (mine.length >= tidies) return json({ error: "That's a lot of tidying. Send it as it is, or try again in a few minutes." }, 429);
    const input = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    let asked: TidyInput;
    if (input.kind === "request") {
      const name = line(input.name, LIMITS.name);
      if (sameName(name).length < 2) return json({ error: "What would you like?" }, 400);
      asked = { kind: "request", name, note: lines(input.note, LIMITS.note) };
    } else {
      const description = lines(input.description, LIMITS.description);
      // A word or two needs no tidying.
      if (description.length < 12) return json({ error: "Say a little more about what went wrong first." }, 400);
      asked = { kind: "bug", description, screen: line(input.screen, 60) || undefined, scope: line(input.scope, 40) || undefined };
    }
    tidied.set(who, [...mine, at]);
    const result = await tidier(asked);
    if (!result) return json({ error: "It couldn't be tidied just now. You can send it in your own words." }, 502);
    return json(result);
  }

  /**
   * A request: a name and a note. One someone has already made (and that's still open) gets a comment,
   * not a second issue, so the issue's comments count how many want it.
   */
  async function makeRequest(request: Request): Promise<Response> {
    if (!enabled) return json({ error: "Requests aren't set up here yet." }, 503);
    const who = await whoIs(request);
    const wait = tooMany(who, "requests");
    if (wait) return json({ error: wait }, 429);

    const input = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    const name = line(input.name, LIMITS.name);
    const note = lines(input.note, LIMITS.note);
    if (sameName(name).length < 2) return json({ error: "What would you like?" }, 400);
    // What the person first wrote, when they're sending a tidied version: kept with it, folded away.
    const given = input.original && typeof input.original === "object" ? (input.original as Record<string, unknown>) : null;
    const original = given ? { name: line(given.name, LIMITS.name), note: lines(given.note, LIMITS.note) } : null;
    const theirWords = original && (original.name !== name || original.note !== note) ? [details(`The ${user}'s own words`, [`Request: ${plain(original.name)}`, "", original.note ? quote(original.note) : "_No note._"].join("\n")), ""] : [];
    const tidyMark = theirWords.length ? ` Tidied with AI; the ${user} looked it over before sending.` : "";

    const asked = (await github<Issue[]>("GET", `/issues?state=open&labels=${encodeURIComponent(requestLabel)}&per_page=100`)) ?? [];
    const already = asked.find((i) => !i.pull_request && typeof i.number === "number" && sameName((i.title ?? "").replace(requestPrefix, "")) === sameName(name));
    const foot = `_Sent from inside ${app} with “${requestAction}”, ${new Date(now()).toISOString().slice(0, 10)}.${tidyMark}_`;
    if (already) {
      const said = await github<{ id?: number }>("POST", `/issues/${already.number}/comments`, { body: [`Another ${user} asked for this.`, ...(note ? ["", quote(note)] : []), "", ...theirWords, foot].join("\n") });
      if (!said) return json({ error: "The request couldn't be sent just now. Try again in a minute." }, 502);
      count(who);
      return json({ ok: true, number: already.number, url: urlOf(already), again: true }, 201);
    }
    const body = [`A ${user} asked for **${plain(name)}**.`, "", note ? quote(note) : "_They didn't add a note._", "", ...theirWords, foot].join("\n");
    const issue = await github<Issue>("POST", "/issues", { title: `${requestTitle}: ${plain(name)}`, body, labels: requestLabels });
    if (!issue || typeof issue.number !== "number") return json({ error: "The request couldn't be sent just now. Try again in a minute." }, 502);
    count(who);
    return json({ ok: true, number: issue.number, url: urlOf(issue), again: false }, 201);
  }

  async function report(request: Request): Promise<Response> {
    if (!enabled) return json({ error: "Reporting isn't set up here yet." }, 503);
    if (Number(request.headers.get("content-length") ?? 0) > reportLimit) return json({ error: "That report is too big to send." }, 413);
    const who = await whoIs(request);
    const wait = tooMany(who, "reports");
    if (wait) return json({ error: wait }, 429);

    const input = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    const description = lines(input.description, LIMITS.description);
    // A title the person chose (or kept from a tidy-up), and what they first wrote when it was tidied.
    const chosenTitle = line(input.title, LIMITS.title);
    const original = lines(input.original, LIMITS.description);
    const screen = line(input.screen, 60);
    const scope = line(input.scope, 40);
    const ref = line(input.ref, 40);
    const built = line(input.built, 40);
    const errors = (Array.isArray(input.errors) ? input.errors : []).slice(-ERRORS_KEPT).map((e) => lines(e, 1200)).filter(Boolean);
    const browser = browserOf(input.browser);
    const shot = jpegOf(input.screenshot);
    if (input.screenshot && !shot) return json({ error: "That picture couldn't be sent. Try again without it." }, 400);
    const about = ref && options.enrich ? await options.enrich({ ref, screen, scope }, request) : null;

    const origin = originOf(request);
    // Without an address of our own there's nowhere for the picture's link to point.
    const shotId = shot && origin ? await keep(shot) : null;

    const where = [screen || "somewhere in the app", scope && `(${scope})`].filter(Boolean).join(" ");
    const firstLine = description.split("\n")[0]!.trim();
    const title = chosenTitle || (firstLine ? (firstLine.length > 80 ? `${firstLine.slice(0, 79).trimEnd()}…` : firstLine) : `Problem reported on ${where}`);
    const rewritten = original !== "" && original !== description;
    const body = [
      description ? quote(description) : `_The ${user} didn't add a description._`,
      "",
      "| | |",
      "| --- | --- |",
      `| Where | ${plain(where)} |`,
      ...(version ? [`| Server version | \`${version}\` |`] : []),
      ...(built ? [`| Page built | ${plain(built)} |`] : []),
      `| Sent | ${new Date(now()).toISOString()} |`,
      "",
      ...(shotId ? [`![What the ${user} saw](${origin}${mount}/shots/${shotId}.jpg)`, ""] : []),
      ...(errors.length ? [details(`Errors the page logged (${errors.length})`, fence(errors.join("\n\n"))), ""] : []),
      ...(about?.length ? [details(options.enrichTitle ?? "Context", fence(about.join("\n"))), ""] : []),
      ...(browser ? [details("Browser", fence(browser)), ""] : []),
      ...(rewritten ? [details(`The ${user}'s own words`, quote(original)), ""] : []),
      `_Sent from inside ${app} with “${reportAction}”.${rewritten ? ` Tidied with AI; the ${user} looked it over before sending.` : ""}${shot ? "" : " No screenshot."}${browser ? "" : ` The ${user} chose not to share browser details.`}_`,
    ].join("\n");

    const issue = await github<Issue>("POST", "/issues", { title: plain(title), body, labels: bugLabels });
    if (!issue || typeof issue.number !== "number") {
      if (shotId) await drop(shotId);
      return json({ error: "The report couldn't be sent just now. Try again in a minute." }, 502);
    }
    count(who);
    if (ref) await store.patch("reports", { [`n${issue.number}`]: { ref, at: now() } });
    return json({ ok: true, number: issue.number, url: urlOf(issue) }, 201);
  }

  /** Answers the routes below; null for anything else, so it can sit in front of the rest of your server. */
  async function fetchRoute(request: Request): Promise<Response | null> {
    const { pathname } = new URL(request.url);
    if (pathname !== mount && !pathname.startsWith(`${mount}/`)) return null;
    const action = pathname.slice(mount.length).split("/").filter(Boolean).join("/");
    // GET <mount>/config → whether the page should offer reporting at all, and tidying
    if (action === "config" && request.method === "GET") return json({ enabled, tidy: !!tidier });
    // POST <mount>/tidy { kind: "bug", description, screen?, scope? } → { kind, title, report }
    //                or { kind: "request", name, note? } → { kind, name, note }: for the person to look over
    if (action === "tidy" && request.method === "POST") return tidy(request);
    // POST <mount> { description?, title?, original?, screen?, scope?, ref?, built?, errors?, browser?, screenshot? } → { number, url }
    if (action === "" && request.method === "POST") return report(request);
    // POST <mount>/request { name, note?, original? } → { number, url, again }
    if (action === "request" && request.method === "POST") return makeRequest(request);
    // GET <mount>/shots/<id>.jpg → a screenshot an issue links to
    const shot = action.match(/^shots\/([a-z0-9]{20})\.jpg$/);
    if (shot && request.method === "GET") {
      const jpeg = (await store.read(`shot-${shot[1]}`))?.jpeg;
      if (typeof jpeg !== "string") return json({ error: "That picture is gone." }, 404);
      return new Response(Buffer.from(jpeg, "base64"), {
        headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
      });
    }
    return json({ error: "Not found" }, 404);
  }

  return {
    enabled,
    repo,
    mount,
    /** For `fetch`-style servers: answers the relay's routes, or resolves null for any other path. */
    fetch: fetchRoute,
    /**
     * For Node's http: answers and resolves true, or resolves false for any other path. Reads no more
     * than `reportLimit` bytes of a body, and turns away what's bigger.
     */
    async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname !== mount && !url.pathname.startsWith(`${mount}/`)) return false;
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        if ((size += (chunk as Buffer).length) > reportLimit) {
          res.writeHead(413, { "content-type": "application/json", connection: "close" });
          res.end(JSON.stringify({ error: "That's too big to send." }));
          return true;
        }
        chunks.push(chunk as Buffer);
      }
      const request = new Request(url, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
      });
      const response = (await fetchRoute(request))!;
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return true;
    },
  };
}

export type Relay = ReturnType<typeof createRelay>;
export { plain, memoryStore };
export type { RelayStore, Tidied, TidyInput };
