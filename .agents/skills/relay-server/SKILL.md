---
name: relay-server
description: Add open.relay to a server so people can report problems and ask for things from inside the app, each becoming a GitHub issue. Use when wiring createRelay, mounting /relay, setting the token, limits, identity, a store, enrich, or tidying with a model.
---

`@journey-to-code/relay/server` turns a report or request into a GitHub issue. It answers plain `Request`/`Response`, so it fits any server.

## Ask first

Do not guess these. Ask if the project does not show them.

- Which repository should issues go to (`owner/name`)?
- How does the server mount routes (Hono/Fetch handler, Express/Node `http`)?
- Behind a proxy or CDN? That decides identity (below).
- Does it run on more than one instance, or serverless? That decides the store.

## Steps

1. `npm install @journey-to-code/relay`. Needs Node 22.12 or later.
2. Create a fine-grained GitHub token for that one repository with **Issues: read and write**. Put it in an environment variable. Never in client code, a bundle or a repo.
3. Create the relay once and mount it:

   ```ts
   import { createRelay } from "@journey-to-code/relay/server";

   const relay = createRelay({ token: process.env.GITHUB_TOKEN, repo: "you/your-app", appName: "Your App" });

   // Fetch-style server (Hono, Bun, Deno, Workers):
   app.all("/relay/*", (c) => relay.fetch(c.req.raw) ?? c.notFound());
   // Node http or Express:
   app.use(async (req, res, next) => ((await relay.handle(req, res)) ? undefined : next()));
   ```

   `fetch(request)` returns a `Response`, or `null` when the path is not the relay's. `handle(req, res)` returns whether it answered. With no token or repo, `enabled` is false and the routes answer 503, so a missing token fails quietly in development.
4. Check: `GET /relay/config` returns `{"enabled":true,"tidy":false}`. Then send a report from the client and see the issue appear.

## Decisions

- **Identity.** The default is the first `x-forwarded-for` address. If nothing in front sets that header, everyone shares one bucket. If a client can set it, the per-person limit can be bypassed (the daily cap still holds). Pass `identify(request)` to use something you trust, such as a session id.
- **Store.** The default is in memory: limits and screenshots reset when the process restarts and are not shared between instances. Pass a `store` (`{ read, patch }`) backed by a database or KV when either matters. Screenshots are served at `/relay/shots/<id>.jpg` from the store, so a screenshot link in an issue breaks if the store forgets it.
- **`enrich(info, request)`** describes a `ref` for the issue. Everything it returns is **public in the issue**.
- **Tidying** is optional and uses the project's own model: see `createTidy` from `@journey-to-code/relay/tidy`. Give the model call its own timeout.

## Do not

- Put the token, a person's name, email or cookie in an issue, a `ref` or `enrich`.
- Raise `each`, `daily` or `reportLimit` without a reason. They protect the GitHub API and the repository from spam.

## Reference

`docs/server.md`, `docs/http-api.md`, `docs/tidying.md`. Published at https://journey-to-code-org.github.io/open.relay/.
