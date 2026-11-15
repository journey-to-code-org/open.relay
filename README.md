# open.relay

Let people report a bug or ask for a feature from inside your app, with no GitHub account. Your server turns what they send into an issue.

It began as the "Report a problem" and "Ask for a game" buttons in a card-game website, and was pulled out because it kept proving useful.

**Documentation: <https://journey-to-code-org.github.io/open.relay/>** (the pages are in [`docs/`](docs/README.md)). Coding agents: see [`AGENTS.md`](AGENTS.md) and [`.agents/skills`](.agents/skills).

Two packages:

| Package | What it is |
| --- | --- |
| [`@journey-to-code/relay`](packages/core) | The server (files issues on GitHub), the client (gathers context, sends), and the optional model-tidying helper. No UI. |
| [`@journey-to-code/relay-ui`](packages/ui) | The interface. Framework-free flow controllers; React bindings; default sheets you can restyle, re-word, or swap piece by piece. |

The UI is a separate package on purpose: use the defaults, extend them, or build your own sheets (Vue, Svelte, Solid, Angular, web components) on the same controllers.

## What a person sees

- A button opens a sheet. They write a line, or nothing.
- They say yes or no, separately, to a **picture of their screen** and to their **browser's details**. They can see exactly what would be sent.
- If you gave the server a model, **Next** shows them a tidied title and report to look over. They can edit it, put their own words back, or go back. Nothing is sent until they press Send, and their own words go along folded away.
- Asking for something works the same way. If someone already asked, their voice is added as a comment on the open issue, so the comment count says how many want it.

## What goes in the issue

Public issues need care, so the issue is built from as little as explains the problem: their words, which screen and scope they were on, the last few errors the page logged, the page's build, and only what they agreed to of the picture and browser details. Never their name, cookie or address. Their text is escaped so it can't `@mention` anyone, reference other issues, inject HTML, or break out of a code block. Limits are per person and per day.

## Server

```ts
import { createRelay } from "@journey-to-code/relay/server";

const relay = createRelay({
  token: process.env.GITHUB_TOKEN,   // may open issues on `repo`; never leaves the server
  repo: "you/your-app",
  appName: "Your App",
  version: process.env.COMMIT_SHA,
});

// fetch-style servers (Hono, Bun, Deno, Workers…): null for any other path
const response = await relay.fetch(request);

// or Node's http: resolves false for any other path
if (await relay.handle(req, res)) return;
```

Without a token, reporting is off and the client says so, so the buttons never show.

| Option | Use |
| --- | --- |
| `store` | Where screenshots and which `ref` each issue came from are kept. A two-method adapter (`read`, `patch`); the default is in memory. |
| `identify` | Who is asking, for the limits (a signed-in user, a cookie). Default: the address. |
| `enrich` | Describe a `ref` (an order, a room, a document) in lines for the issue. Never say who is involved. |
| `tidy` | Turns tidying on. See below. |
| `labels`, `requestTitle`, `actions`, `appName`, `userNoun`, `mount` | The words and places that make it yours. |
| `each`, `daily`, `tidies`, `reportLimit` | The limits. |

## Tidying with a model

You bring the model; relay never talks to one itself.

```ts
import { createTidy } from "@journey-to-code/relay/tidy";

const relay = createRelay({
  /* … */
  tidy: createTidy((system, user) => askMyModel(system, user), {
    app: "a family card-game website",
    asking: "a game the website doesn't have yet",
    nameHint: "the game's usual name, spelled properly in Title Case",
  }),
});
```

Whatever you return from `askMyModel` is parsed as JSON and checked; if the model fails or answers badly, the person simply sends their own words.

## Client

```ts
import { createRelayClient } from "@journey-to-code/relay/client";

export const relay = createRelayClient({ base: "/relay", built: BUILD_TIME });
relay.watchForErrors();                           // remember the last few errors
relay.setContext({ screen: "checkout", scope: "coupons", ref: order.id });
```

The picture uses [`modern-screenshot`](https://github.com/qq15725/modern-screenshot), an optional peer dependency: install it to offer screenshots, leave it out and the sheet says none could be taken. Anything with a `data-no-screenshot` attribute is left out of the picture.

## UI

```tsx
import { createReportFlow, createRequestFlow } from "@journey-to-code/relay-ui";
import { ReportButton, ReportSheet, RequestButton, RequestSheet } from "@journey-to-code/relay-ui/react";
import "@journey-to-code/relay-ui/styles.css"; // optional

const report = createReportFlow(relay);
const request = createRequestFlow(relay, { findExisting: (name) => myCatalogue.find(name) });

<ReportButton flow={report} />
<ReportSheet flow={report} />
<RequestSheet flow={request} renderExisting={(item) => <>Good news: {item.name} is already here.</>} />
```

Open the report sheet from anywhere, such as a crash screen, with `report.open()`.

**Making it yours**, from lightest to heaviest:

1. **CSS.** Everything is a `relay-*` class, and `styles.css` is themed with a few CSS variables (or skip it).
2. **`classes`.** Already have styles for sheets, buttons and fields? Point each part at your own class instead: `<ReportSheet classes={{ sheet: "sheet", primary: "btn btn-primary" }} />` replaces just those.
3. **`copy`.** Every word, one at a time: `<ReportSheet copy={{ title: "Something broke?" }} />`.
4. **`slots`.** Swap the toggle and text field for your design system's. Each takes plain props and a plain `onChange`:

   ```tsx
   import ToggleSwitch from "my-design-system/toggle-switch";
   const Toggle = ({ label, description, checked, onChange }: ToggleProps) => (
     <ToggleSwitch label={label} description={description} checked={checked} onCheckedChange={(e: CustomEvent<boolean>) => onChange(e.detail)} />
   );
   <ReportSheet flow={report} slots={{ Toggle }} />
   ```
5. **Your own sheet.** `useFlow(flow)` gives the state, and the flow has every action (`open`, `next`, `send`, `editDraft`, `useOriginal`, `useTidied`, …). The flows are plain objects with `getState`/`subscribe`, so any framework can drive them.

## Layout

```
packages/core   @journey-to-code/relay      server · client · tidy
packages/ui     @journey-to-code/relay-ui   flows · react · styles.css
```

```sh
npm install
npm test        # builds, then runs both packages' tests
npm run typecheck
```

## Releasing

Bump `version` in the package(s) that changed, in a PR. When it reaches `main`, [`release.yml`](.github/workflows/release.yml) builds and tests, publishes whatever isn't on npm yet (`relay` before `relay-ui`, which needs it), and tags and releases each as `relay-v<version>` / `relay-ui-v<version>`. No token is stored: npm trusts that workflow. It's [release-on-bump](https://github.com/journey-to-code-org/release-on-bump), and it can be run again from the Actions tab if it stops partway.

## Status

0.1.0 on npm. [MIT](LICENSE).
