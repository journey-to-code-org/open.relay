import { createRelay } from "@journey-to-code/relay/server";

export interface Env {
  /** A GitHub token that may open issues on REPO. Set with `wrangler secret put GITHUB_TOKEN`. */
  GITHUB_TOKEN?: string;
  /** Where issues go, "owner/name". */
  REPO: string;
  /** Pages allowed to call this, comma separated: "https://journey-to-code-org.github.io". */
  ALLOWED_ORIGINS: string;
}

export interface Deps {
  fetch?: typeof fetch;
  now?: () => number;
}

const MOUNT = "/relay";

/** The relay for the docs site. Everything it files is labelled `demo`, so no one mistakes it for a real report. */
export function relayFor(env: Env, deps: Deps = {}) {
  return createRelay({
    token: env.GITHUB_TOKEN,
    repo: env.REPO,
    mount: MOUNT,
    appName: "the open.relay docs site, as a demo",
    userNoun: "reader",
    // The last label of a request is the one open requests are looked up by.
    labels: { bug: ["demo", "demo report"], request: ["demo", "demo request"] },
    requestTitle: "Demo request",
    // A Worker sits behind Cloudflare, which says who is asking; x-forwarded-for may be anything.
    identify: (request) => {
      const ip = request.headers.get("cf-connecting-ip");
      return ip ? `ip:${ip}` : undefined;
    },
    // Isolates come and go, so these limits are per isolate: a floor, not a guarantee.
    each: 3,
    daily: 20,
    fetch: deps.fetch,
    now: deps.now,
  });
}

// One relay per isolate: its limits live in the relay, so a new one for every request would have none.
const relays = new WeakMap<Env, ReturnType<typeof relayFor>>();
function relayFrom(env: Env, deps: Deps) {
  let relay = relays.get(env);
  if (!relay) relays.set(env, (relay = relayFor(env, deps)));
  return relay;
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
  const headers: Record<string, string> = { vary: "origin" };
  if (origin && allowed.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
    headers["access-control-allow-headers"] = "content-type";
    headers["access-control-max-age"] = "86400";
  }
  return headers;
}

export async function handle(request: Request, env: Env, deps: Deps = {}): Promise<Response> {
  const cors = corsHeaders(request, env);
  const { pathname } = new URL(request.url);

  if (pathname !== MOUNT && !pathname.startsWith(`${MOUNT}/`)) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "content-type": "application/json", ...cors } });
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const relay = relayFrom(env, deps);
  const answer = await relay.fetch(request);
  if (!answer) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "content-type": "application/json", ...cors } });
  const headers = new Headers(answer.headers);
  for (const [name, value] of Object.entries(cors)) headers.set(name, value);
  return new Response(answer.body, { status: answer.status, headers });
}
