---
order: 1
---

# Getting started

A working report button in four steps: a server route, a client, a button, and a check.

## 1. Install

```sh
npm install @journey-to-code/relay @journey-to-code/relay-ui
```

Both are needed for a React app. If your interface is not React, or you build your own sheets, the server and client are in `@journey-to-code/relay` alone and `relay-ui` is optional. To offer screenshots, also install the optional [`modern-screenshot`](https://github.com/qq15725/modern-screenshot).

## 2. Add the server

Make a GitHub token that may open issues on one repository (a fine-grained token limited to that repository is the safest kind), and keep it on the server.

```ts
import { createRelay } from "@journey-to-code/relay/server";

const relay = createRelay({
  token: process.env.GITHUB_TOKEN, // never leaves the server
  repo: "you/your-app",            // where issues are filed
  appName: "Your App",
  version: process.env.COMMIT_SHA, // optional: what is deployed
});
```

Put it in front of the rest of your server. Both forms answer only the relay's own paths (under `/relay` unless you set `mount`) and pass everything else on:

```ts
// A fetch-style server (Hono, Bun, Deno, Workers…): null for any other path
const response = await relay.fetch(request);
if (response) return response;

// Node's http: resolves false for any other path
if (await relay.handle(req, res)) return;
```

Without a token, reporting is off and the client says so, so the buttons never show.

## 3. Add the client and the button

```tsx
import { createRelayClient } from "@journey-to-code/relay/client";
import { createReportFlow } from "@journey-to-code/relay-ui";
import { ReportButton, ReportSheet } from "@journey-to-code/relay-ui/react";
import "@journey-to-code/relay-ui/styles.css"; // optional

export const relay = createRelayClient({ base: "/relay" });
relay.watchForErrors();
const report = createReportFlow(relay);

export function Feedback() {
  return (
    <>
      <ReportButton flow={report} />
      <ReportSheet flow={report} />
    </>
  );
}
```

Tell it where the person is, whenever that changes, so the issue says so:

```ts
relay.setContext({ screen: "checkout", scope: "coupons", ref: order.id });
```

## 4. Check it

1. `GET /relay/config` should answer `{"enabled":true,"tidy":false}`. `enabled: false` means the token or repo is missing.
2. Open the page. The button appears only when reporting is enabled.
3. Send a report. It should come back with an issue number, and the issue should exist on your repository.

If the button does not appear, see [the client](client.md#when-the-button-does-not-show). If a send fails, the error text from the server is shown in the sheet; the [HTTP API](http-api.md#errors) lists them.

## Asking for a feature

A second flow does the same for feature requests, and adds a person's voice to an issue that already exists:

```tsx
import { createRequestFlow } from "@journey-to-code/relay-ui";
import { RequestSheet } from "@journey-to-code/relay-ui/react";

const request = createRequestFlow(relay, { findExisting: (name) => catalogue.find(name) });
<RequestSheet flow={request} />;
```

`findExisting` lets you stop someone asking for something you already have. See [the interface](ui.md#asking-for-something).
