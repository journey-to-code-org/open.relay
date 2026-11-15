---
order: 10
---

# Try it

The **Report a problem** button at the corner of these pages is open.relay, used as it is meant to be. Press it and send something: it becomes a real issue on [journey-to-code-org/open.relay](https://github.com/journey-to-code-org/open.relay/issues?q=label%3Ademo).

Every issue it files carries the **`demo`** label and says in its body that it came from the docs demo, so none of them is a real bug report. They are closed in batches.

If the button is missing, the demo server is switched off, and the rest of the page is unaffected.

## How it is put together

- **The button** is [`docs-site/widget/relay-widget.ts`](https://github.com/journey-to-code-org/open.relay/blob/main/docs-site/widget/relay-widget.ts): about a hundred lines of plain DOM on top of `createRelayClient` and `createReportFlow`. No framework, which also shows the flow controllers working outside React.
- **The server** is [`packages/docs-worker`](https://github.com/journey-to-code-org/open.relay/tree/main/packages/docs-worker): a [Cloudflare Worker](https://developers.cloudflare.com/workers/) around `createRelay`. `createRelay` speaks plain `Request` and `Response`, so it runs there unchanged. The Worker adds the three things a docs site needs and an app does not: it labels every issue `demo`, it answers CORS for the docs origin only, and it identifies people by Cloudflare's `cf-connecting-ip`.
- **The page** loads the button through one `<script>` tag in `docs-site/openblog.json` (`snippets.bodyEnd`). Its `data-relay` attribute is the Worker's address; empty, the button never appears.

## Run your own

Use this as a template for a relay on any static site.

1. Create a [fine-grained GitHub token](https://github.com/settings/personal-access-tokens/new) limited to your repository, with **Issues: read and write**.
2. In `packages/docs-worker`, set `REPO` and `ALLOWED_ORIGINS` in `wrangler.toml`.
3. `npx wrangler deploy`, then `npx wrangler secret put GITHUB_TOKEN`.
4. Put the Worker's address in the script tag's `data-relay`.

The limits (three reports per person per ten minutes, twenty a day) are kept per Worker instance, so they are a floor and not a guarantee. If a public demo needs a hard limit, add a [rate limiting rule](https://developers.cloudflare.com/waf/rate-limiting-rules/) in front of it.

Screenshots are left out of the demo on purpose: a screenshot of a documentation page adds nothing and needs storage the Worker does not have.
