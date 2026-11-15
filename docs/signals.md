---
order: 8
---

# What uses the Signals API

**Nothing in `@journey-to-code/relay` or `@journey-to-code/relay-ui` uses the Signals API.** This page says what that means, so you can check it and keep it true.

## What "the Signals API" is

The [TC39 Signals proposal](https://github.com/tc39/proposal-signals) is a proposal to add signals (`Signal.State`, `Signal.Computed`, `Signal.subtle`) to JavaScript itself. It is at **Stage 1**, an early stage where the design can still change. Its reference polyfill, [`signal-polyfill`](https://github.com/proposal-signals/signal-polyfill), says it is a preview of an in-progress proposal that could change at any time, and not to use it in production. Libraries built on it, and anything that bundles its own copy of the API, carry the same warning.

Three other things share the word and are **not** the proposal:

- **`AbortSignal`** is the stable DOM API for cancelling a request. It is not a signal in this sense.
- **Process signals** (`SIGTERM`) belong to the operating system.
- **Other libraries' signals** (Solid, Preact, Angular, Vue) are those frameworks' own APIs, not the proposal.

## What these packages use

| Part | Signals API? | What is there instead |
| --- | --- | --- |
| `@journey-to-code/relay` server, client, tidy | No | One `AbortSignal.timeout(15_000)` on each request to GitHub (`packages/core/src/server.ts`). |
| `@journey-to-code/relay-ui` flows | No | A small store with `getState` and `subscribe`. |
| `@journey-to-code/relay-ui/react` | No | React's own `useSyncExternalStore`. |
| The `relay-ui` `Toggle` and `TextField` slots | No | Plain props and a plain `onChange`. |
| This documentation site | No | Static HTML built by open.blog. The build fails if its output mentions the Signals API or a library built on it. |

Neither package depends on `signal-polyfill`, on a framework's signals, or on Zubra.

## Where it could come from

The only way the Signals API reaches a page that uses relay is through something **you** put in it:

- **A design system in a slot.** If you swap the toggle or the text field for a component library whose runtime is built on the proposal (Zubra's is, and uses the browser's native `Signal` when there is one, or its own implementation when there is not), that library is what brings it in. Relay does not know and passes only plain values to your component.
- **Your own sheet.** Flows are plain objects, so you can wrap them in signals yourself. That is your choice, and the production warning is then yours to weigh.

If that matters for your site, check what your slot components import.

## Keeping it true

Two checks run, so this page cannot quietly go stale:

- A test in `packages/core/test/no-signals.test.ts` fails if either package's source, or its `dependencies`, `peerDependencies` or `optionalDependencies`, name the Signals proposal, `signal-polyfill`, `@zubra/runtime`, or `@lit-labs/signals`, or call `Signal.State`, `Signal.Computed` or `Signal.subtle`. It runs with `npm test`, and so before every release.
- The docs build runs `scripts/check-docs-output.mjs` over the finished site and fails if any page contains the same.

If you add a dependency and one of these fails, that is the point: decide on purpose, then change this page and the check together.
