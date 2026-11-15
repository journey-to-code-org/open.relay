---
order: 6
---

# The HTTP API

The routes `createRelay` answers, for a client written in something else. Paths are relative to `mount` (default `/relay`). All bodies and answers are JSON unless noted, and the client in `@journey-to-code/relay/client` speaks exactly this.

| Route | Does |
| --- | --- |
| `GET /config` | Whether the page should offer reporting, and tidying. |
| `POST /tidy` | Tidies what a person wrote, for them to look over. |
| `POST /` | Files a report as an issue. |
| `POST /request` | Files a request, or adds to the one already open. |
| `GET /shots/<id>.jpg` | A screenshot an issue links to. |

Anything else under `mount` is `404 {"error":"Not found"}`. Paths outside `mount` are not the relay's: `fetch` returns `null` and `handle` returns `false`.

## `GET /config`

```json
{ "enabled": true, "tidy": false }
```

`enabled` is false without a token and repo. `tidy` is true only if `tidy` was given to `createRelay`.

## `POST /tidy`

```json
{ "kind": "bug", "description": "…", "screen": "checkout", "scope": "coupons" }
```
```json
{ "kind": "request", "name": "…", "note": "…" }
```

Answers `{ "kind": "bug", "title", "report" }` or `{ "kind": "request", "name", "note" }`.

## `POST /`

```json
{
  "description": "…",
  "title": "…",
  "original": "…",
  "screen": "checkout",
  "scope": "coupons",
  "ref": "order-42",
  "built": "2026-11-15T10:00:00Z",
  "errors": ["10:01:02 error: …"],
  "browser": { "userAgent": "…", "viewport": "…" },
  "screenshot": "data:image/jpeg;base64,…"
}
```

Every field is optional: a person may send a report with no words at all, and the issue is built from what there is. `title` and `original` come from a tidy-up the person kept. `screenshot` is a JPEG data URL, at most 600,000 bytes; `browser` is sent only if they agreed. `ref` is kept by the server and never shown in the issue. The last 10 `errors` are used.

Answers `201` with `{ "ok": true, "number": 12, "url": "https://github.com/…/issues/12" }`.

## `POST /request`

```json
{ "name": "…", "note": "…", "original": { "name": "…", "note": "…" } }
```

Answers `201` with `{ "ok": true, "number": 7, "url": "…", "again": false }`. `again: true` means an open issue with the same name was found, by the request label, and this was added to it as a comment. Only the first 100 open issues with that label are looked at.

A request needs a `name`; without one the answer is `400 {"error":"What would you like?"}`.

## Errors

A failure is a non-2xx status with `{ "error": "words for the person" }`:

| Status | When |
| --- | --- |
| 400 | `POST /tidy` of a bug under 12 characters ("Say a little more about what went wrong first."), `POST /request` with no name ("What would you like?"), or a screenshot that could not be read. |
| 404 | Unknown route, or a screenshot that is gone. |
| 413 | The body is bigger than `reportLimit`. |
| 429 | Too many in ten minutes, or the day's allowance is used. The text says how long to wait. |
| 502 | GitHub, or the model, could not be reached. Safe to try again. |
| 503 | Reporting or requests are not set up (no token), or tidying is off. |

The text is written to be shown to the person as it is.
