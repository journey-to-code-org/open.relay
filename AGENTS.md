# open.relay

Lets the people who use an app report problems and ask for things from inside it. Each becomes a GitHub issue.

- `packages/core`: `@journey-to-code/relay` (server, client, tidy).
- `packages/ui`: `@journey-to-code/relay-ui` (flows, React sheets, CSS).
- `docs/`: the documentation, published at https://journey-to-code-org.github.io/open.relay/.
- `.agents/skills/`: how to use and maintain it: `relay-server`, `relay-client`, `relay-ui`, `relay-maintain`.

Commands: `npm test`, `npm run typecheck` (Node 22.12 or later). Both must pass before a change is done.

Rules: no Signals API in either package (`docs/signals.md`); nothing identifying in public issues; docs change with the code. `relay-maintain` has the rest, including releasing.
