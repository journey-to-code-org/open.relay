// What the page gathers for a report, and sending it. The server (see ./server) turns a report into an
// issue on GitHub, so nobody needs an account anywhere.
//
// Gathered without asking, because none of it says who you are: which screen you were on, when this
// copy of the page was built, and the last few errors the page logged. Gathered only if you say yes to
// each: a picture of the screen, and your browser's details.
import type { BrowserInfo, RelayContext, SentReport, SentRequest, Tidied } from "./types.js";

export interface RelayClientOptions {
  /** Where the server mounted the relay. Default "/relay". */
  base?: string;
  /** When this copy of the page was built, for the issue. */
  built?: string;
  /** How requests are made, and with what credentials (so your server can tell who is asking). */
  fetch?: typeof fetch;
  credentials?: RequestCredentials;
}

export interface ReportToSend {
  description: string;
  /** The title the person kept from a tidy-up. */
  title?: string;
  /** What they first wrote, sent along with the tidied words and folded away in the issue. */
  original?: string;
  screenshot: string | null;
  browser: BrowserInfo | null;
}

// ---- The browser's details ------------------------------------------------------------------------

export function browserInfo(): BrowserInfo {
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return {
    userAgent: navigator.userAgent,
    platform: uaData?.platform ?? navigator.platform ?? "",
    viewport: `${innerWidth}×${innerHeight} at ${devicePixelRatio}×`,
    screen: `${screen.width}×${screen.height}`,
    language: navigator.language,
    installed: matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    touch: navigator.maxTouchPoints > 0,
    online: navigator.onLine,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

/** The same details as the lines a person is shown before agreeing to send them. */
export const browserLines = (info: BrowserInfo): [string, string][] => [
  ["Browser", info.userAgent],
  ["Device", info.platform],
  ["Window", info.viewport],
  ["Screen", info.screen],
  ["Language", info.language],
  ["Installed as an app", info.installed ? "yes" : "no"],
  ["Touch screen", info.touch ? "yes" : "no"],
];

// ---- A picture of the screen ----------------------------------------------------------------------

/** Wide enough to read small print; small enough to send from a phone on a poor connection. */
const SHOT_WIDTH = 1100;
const SHOT_BYTES = 450_000;

/**
 * The page as a JPEG (a data: address), or null when this browser can't draw it, or when the optional
 * `modern-screenshot` package isn't installed. It's drawn from the page's own elements, so the browser
 * asks the person nothing, and nothing outside the page is in it. Anything with a `data-no-screenshot`
 * attribute (the report button itself) is left out.
 */
export async function takeScreenshot(): Promise<string | null> {
  try {
    const { domToCanvas } = await import("modern-screenshot");
    const page = document.documentElement;
    const width = page.clientWidth;
    const height = innerHeight;
    const drawn = await domToCanvas(document.body, {
      width,
      height,
      scale: Math.min(devicePixelRatio || 1, SHOT_WIDTH / width, 2),
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
      // What's on screen now, not the top of a long page.
      style: { margin: "0", transform: `translate(${-scrollX}px, ${-scrollY}px)`, transformOrigin: "top left", width: `${page.scrollWidth}px`, height: `${page.scrollHeight}px` },
      filter: (node) => !(node instanceof Element && node.hasAttribute("data-no-screenshot")),
      timeout: 4000,
    });
    for (const quality of [0.8, 0.6, 0.4]) {
      const jpeg = drawn.toDataURL("image/jpeg", quality);
      // Four characters of base64 carry three bytes.
      if (jpeg.startsWith("data:image/jpeg") && jpeg.length * 0.75 < SHOT_BYTES) return jpeg;
    }
    return null;
  } catch {
    return null;
  }
}

// ---- The client -------------------------------------------------------------------------------------

const ERRORS_KEPT = 10;

export function createRelayClient(options: RelayClientOptions = {}) {
  const base = (options.base ?? "/relay").replace(/\/$/, "");
  const call = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const credentials = options.credentials ?? "same-origin";

  let context: RelayContext = { screen: "home" };
  const errors: string[] = [];

  function note(kind: string, problem: unknown) {
    const e = problem as { message?: unknown; stack?: unknown } | null;
    const message = typeof e?.message === "string" ? e.message : String(problem);
    // A stack usually starts with the message; when it does, the stack alone says both.
    const stack = typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 8).join("\n") : "";
    const text = stack.includes(message) ? stack : [message, stack].filter(Boolean).join("\n");
    const at = new Date().toISOString().slice(11, 19);
    errors.push(`${at} ${kind}: ${text}`.slice(0, 1200));
    if (errors.length > ERRORS_KEPT) errors.shift();
  }

  let asked: Promise<{ enabled: boolean; tidy: boolean }> | null = null;
  const config = () =>
    (asked ??= call(`${base}/config`, { credentials })
      .then((r) => (r.ok ? r.json() : {}))
      .then(
        (c: { enabled?: boolean; tidy?: boolean }) => ({ enabled: c.enabled === true, tidy: c.enabled === true && c.tidy === true }),
        () => ({ enabled: false, tidy: false }),
      ));

  /** POST some JSON and read the answer; throws with words for the person when it didn't work. */
  async function post<T>(path: string, body: unknown, unreachable: string, failed: string, ok: (data: Partial<T> & { error?: string }) => boolean): Promise<T> {
    let response: Response;
    try {
      response = await call(`${base}${path}`, { method: "POST", credentials, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    } catch {
      throw new Error(unreachable);
    }
    const data = (await response.json().catch(() => ({}))) as Partial<T> & { error?: string };
    if (!response.ok || !ok(data)) throw new Error(data.error ?? failed);
    return data as T;
  }

  return {
    /** The app says where it is as it moves between screens. */
    setContext: (next: RelayContext) => void (context = next),
    getContext: (): RelayContext => context,

    /** Remember the last few things that went wrong on this page, in case a report is sent. Returns a function that stops. */
    watchForErrors(): () => void {
      const onError = (e: ErrorEvent) => note("error", e.error ?? e.message);
      const onRejection = (e: PromiseRejectionEvent) => note("unhandled rejection", e.reason);
      addEventListener("error", onError);
      addEventListener("unhandledrejection", onRejection);
      const original = console.error;
      console.error = (...args: unknown[]) => {
        try {
          note("console.error", args.length === 1 ? args[0] : args.map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : JSON.stringify(a))).join(" "));
        } catch {
          /* something that can't be put into words */
        }
        original.apply(console, args);
      };
      return () => {
        removeEventListener("error", onError);
        removeEventListener("unhandledrejection", onRejection);
        console.error = original;
      };
    },
    /** Note a problem by hand (the screen that crashed, say). */
    noteError: note,

    browserInfo,
    takeScreenshot,

    /** Whether the server takes reports: asked once. False when there's no server to ask. */
    enabled: () => config().then((c) => c.enabled),
    /** Whether it can tidy a report or request before it's sent. */
    canTidy: () => config().then((c) => c.tidy),

    /** Ask the server to tidy what the person wrote. Throws with words for the person. */
    tidy(input: { kind: "bug"; description: string } | { kind: "request"; name: string; note: string }): Promise<Tidied> {
      return post<Tidied>(
        "/tidy",
        input.kind === "bug" ? { ...input, screen: context.screen, scope: context.scope } : input,
        "Couldn't reach the server to tidy it.",
        "It couldn't be tidied just now.",
        (data) => data.kind === input.kind,
      );
    },

    /** Send a report. Throws with words for the person. */
    async send(report: ReportToSend): Promise<SentReport> {
      const data = await post<SentReport>(
        "",
        { ...report, ...context, built: options.built ?? "", errors },
        "Couldn't reach the server. Check your connection and try again.",
        "The report couldn't be sent just now. Try again in a minute.",
        (d) => typeof d.number === "number",
      );
      return { number: data.number, url: data.url ?? "" };
    },

    /** Ask for something: the server files it, or adds to the request already open. */
    async request(name: string, note: string, original?: { name: string; note: string }): Promise<SentRequest> {
      const data = await post<SentRequest>(
        "/request",
        { name, note, original },
        "Couldn't reach the server. Check your connection and try again.",
        "The request couldn't be sent just now. Try again in a minute.",
        (d) => typeof d.number === "number",
      );
      return { number: data.number, url: data.url ?? "", again: data.again === true };
    },
  };
}

export type RelayClient = ReturnType<typeof createRelayClient>;
export type { BrowserInfo, RelayContext, SentReport, SentRequest, Tidied };
