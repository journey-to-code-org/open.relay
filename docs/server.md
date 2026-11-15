---
order: 2
---

# The server

`createRelay(options)` from `@journey-to-code/relay/server` returns the object that files issues. Every option is optional; with no token, reporting is simply off.

```ts
const relay = createRelay({ token, repo: "you/your-app", appName: "Your App" });

relay.enabled; // whether a token and a repo were given
relay.repo;    // "you/your-app"
relay.mount;   // "/relay"
relay.fetch(request);   // Response | null
relay.handle(req, res); // Promise<boolean>
```

## Options

| Option | Default | Use |
| --- | --- | --- |
| `token` | none | A GitHub token that may open issues and comments on `repo`. Without one, reporting is off. |
| `repo` | none | Where issues go, as `"owner/name"`. Required with a token. |
| `version` | none | What is deployed (a commit), shown in the issue. |
| `appName` | `"the app"` | What your app calls itself in the line at the foot of each issue. |
| `userNoun` | `"user"` | What you call the people who use it (`"player"`, `"customer"`). |
| `actions` | | The words for the two actions as the issue footer names them: `{ report, request }`. |
| `labels` | `bug` + `<user> report`; `enhancement` + `feature request` | Labels for a bug and for a request: `{ bug: [...], request: [...] }`. The **last** label of a request is the one it is looked up by. |
| `requestTitle` | `"Feature request"` | The start of a request's title, before its name. |
| `mount` | `"/relay"` | Where the routes live. |
| `store` | in memory | Where screenshots and each issue's `ref` are kept. See [the store](#the-store). |
| `identify` | the address | Who is asking, for the limits. See [identity and limits](#identity-and-limits). |
| `enrich` | none | Describe a `ref` in lines for the issue. See [enrich](#describing-a-ref-with-enrich). |
| `enrichTitle` | `"Context"` | What those lines are called in the issue. |
| `tidy` | off | Turns tidying on. See [tidying](tidying.md). |
| `each` | `3` | Reports one person may send in ten minutes. |
| `daily` | `40` | Reports everyone together may send in a day. |
| `tidies` | `8` | Tidy-ups one person may ask for in ten minutes. |
| `reportLimit` | `1_000_000` | The most bytes of a request body it will read. |

`fetch` and `now` exist for tests.

## Mounting

Both entry points answer only paths at or under `mount` and pass anything else on, so the relay sits in front of the rest of your server without taking it over.

- `relay.fetch(request)` resolves a `Response`, or `null` for any other path.
- `relay.handle(req, res)` is for Node's `http`. It resolves `true` if it answered, `false` for any other path, and reads no more than `reportLimit` bytes of a body.

## The store

The server keeps very little: screenshots (an issue links to one), when each was taken so the oldest can go, and which `ref` each issue came from, for whoever runs the server. Bring your own by passing a two-method adapter:

```ts
interface RelayStore {
  read(key: string): Promise<Record<string, unknown> | undefined>;
  patch(key: string, fields: Record<string, unknown>): Promise<void>; // merge; a field set to null is removed
}
```

`patch` merges `fields` into the record at `key`. That is how a sync log or a document store already behaves, so an adapter is a few lines. The default `memoryStore()` is for development and tests: screenshots and refs are gone on restart, and an issue's picture link then answers "That picture is gone."

Keys the relay uses are `shot-<id>`, `shots` and `reports`.

## Identity and limits

The limits (`each`, `daily`, `tidies`) need a stable answer to "who is asking". `identify` gives it:

```ts
createRelay({ identify: (request) => sessionUserId(request) }); // a signed-in user, or a cookie
```

With no `identify`, the key is the first value of the `x-forwarded-for` header, or the word `unknown` without one. Two things follow:

- **Behind a proxy that does not set `x-forwarded-for`, everyone shares one bucket**, and three reports in ten minutes would lock everybody out. Set `identify`, or make the proxy set the header.
- **If your edge does not overwrite `x-forwarded-for`, a person can change it** and so get past the per-person limit. The daily cap still holds. Prefer `identify` from a session or signed cookie.

Whatever `identify` returns is used only to count. It is never put in an issue.

## Describing a ref with `enrich`

A `ref` is something only your server can look up: a table, an order, a document. The client sends it with the report; the issue never shows it. `enrich` turns it into lines the issue does show:

```ts
createRelay({
  enrichTitle: "The order",
  enrich: async ({ ref, screen, scope }, request) => {
    const order = await orders.find(ref);
    return order ? [`Status: ${order.status}`, `Items: ${order.items.length}`] : null;
  },
});
```

Never say who is involved. These lines are public. Return `null` when you cannot describe it.

## What is made safe

Every piece of a person's text passes through helpers before it reaches a public issue. They are exported from `@journey-to-code/relay` (the main entry, not `/server`) if you build your own around them: `plain`, `quote`, `fence`, `details`, `line`, `lines` and `sameName`. Text cannot `@mention` anyone, reference other issues, inject HTML, or break out of a code block, and each field is cut to its limit (`LIMITS`: 2000 characters of description, 90 of a title, 60 of a name, 600 of a note, and a screenshot of at most 600,000 bytes).

## Token

Use the narrowest token that works: a fine-grained token limited to the one repository, allowed to create issues and comments. It lives in your server's environment and is never sent to a browser. A token on a private deployment still files issues on a repository that may be public, so write nothing in an `enrich` line you would not publish.
