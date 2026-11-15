---
order: 3
---

# The client

`createRelayClient(options)` from `@journey-to-code/relay/client` runs in the browser. It gathers context, asks the server whether reporting is on, and sends. It has no interface; [the interface package](ui.md) is built on it, and so can yours be.

```ts
import { createRelayClient } from "@journey-to-code/relay/client";

export const relay = createRelayClient({ base: "/relay", built: BUILD_TIME });
```

| Option | Default | Use |
| --- | --- | --- |
| `base` | `"/relay"` | Where the server mounted the relay. Match the server's `mount`. |
| `built` | none | When this copy of the page was built, shown in the issue. |
| `fetch` | the global one | How requests are made. |
| `credentials` | `"same-origin"` | Passed to `fetch`, so your server can tell who is asking when `identify` reads a cookie. |

## Saying where the person is

```ts
relay.setContext({ screen: "checkout", scope: "coupons", ref: order.id });
relay.getContext();
```

- `screen` is the screen in a word or two. It is the only required part.
- `scope` is a narrower label the issue shows beside the screen (a feature, a plan).
- `ref` is something only your server can look up. It travels with the report and is [described by `enrich`](server.md#describing-a-ref-with-enrich); the issue itself never shows it.

Call `setContext` whenever the person moves. It starts as `{ screen: "home" }`.

## Remembering errors

```ts
const stop = relay.watchForErrors(); // later: stop()
relay.noteError("render", error);    // by hand, for a crash screen
```

`watchForErrors()` keeps the last **10** problems in memory: uncaught errors, unhandled promise rejections, and calls to `console.error`. Each is cut to 1,200 characters. They are sent only when a report is sent, and appear in the issue.

It does this by **wrapping `console.error`**, which is global. The original still runs, and the function it returns puts it back. If another library also wraps `console.error`, stop in the reverse of the order you started.

## The picture and the browser's details

```ts
await relay.takeScreenshot(); // a JPEG data URL, or null
relay.browserInfo();          // the browser, platform, viewport, language…
```

The picture is drawn from the page's own elements, so the browser asks the person nothing and nothing outside the page is in it. It needs the optional peer dependency [`modern-screenshot`](https://github.com/qq15725/modern-screenshot). Without it `takeScreenshot()` returns `null` and the sheet says none could be taken. It is shrunk until it fits well under the 600,000 byte limit.

Mark anything private with `data-no-screenshot` and it is left out of the picture:

```html
<div data-no-screenshot>Card number…</div>
```

The report button carries that attribute itself, so it is never in its own picture.

The default sheets ask the person, separately, before either goes along. If you build your own interface, do the same: pass `screenshot: null` or `browser: null` unless they said yes.

## Asking the server

| Method | Returns |
| --- | --- |
| `enabled()` | Whether the server takes reports. Asked once; `false` when there is no server to ask. |
| `canTidy()` | Whether the server will [tidy](tidying.md) before sending. |
| `tidy(input)` | A tidied version for the person to look over. Throws with words for them. |
| `send(report)` | `{ number, url }` of the issue. Throws with words for them. |
| `request(name, note, original?)` | `{ number, url, again }`; `again` is true when it was added to an issue already open. |

`send` takes `{ description, title?, original?, screenshot, browser }`. The context and recent errors are added for you.

The errors thrown are written for the person, not for you ("Couldn't reach the server. Check your connection and try again."), so they can be shown as they are.

## When the button does not show

The button and sheet render nothing until `enabled()` is true. Check in this order:

1. `GET /relay/config` in the browser's network tab. A 404 means the route is not mounted where `base` points.
2. `{"enabled":false}` means the server has no `token` or no `repo`.
3. The request was blocked: a cross-origin `base` needs CORS on your server, and `credentials` set to match.

`enabled()` asks once and remembers the answer, so reload after fixing the server.
