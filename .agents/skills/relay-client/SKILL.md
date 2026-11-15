---
name: relay-client
description: Add the open.relay browser client to a front end. Use when calling createRelayClient, setting the screen context, capturing console errors, taking a screenshot, or building a report or request interface without the ready-made sheets.
---

`@journey-to-code/relay/client` runs in the browser. It gathers context and sends to the server's relay routes. It has no interface of its own; see `relay-ui` for sheets.

## Steps

1. The server must be mounted first (`relay-server`). `GET <base>/config` should answer `{"enabled":true,…}`.
2. Create one client and keep it for the page's life:

   ```ts
   import { createRelayClient } from "@journey-to-code/relay/client";
   export const relay = createRelayClient({ base: "/relay", built: BUILD_TIME });
   ```

   `base` must equal the server's `mount`. Pass `credentials: "include"` only if the server is another origin and `identify` reads a cookie.
3. Tell it where the person is, on every screen change: `relay.setContext({ screen: "checkout", scope: "coupons", ref: order.id })`. `screen` is required and short. `ref` is for the server to look up and is not shown in the issue.
4. Start remembering errors once, at startup: `const stop = relay.watchForErrors()`. It keeps the last 10, and **wraps `console.error` globally**; call `stop()` to undo it.
5. Check: break something in the page, open the report, and see the error in the sent issue.

## What must be asked

A screenshot and browser details are the person's to allow, **separately, each time**. `takeScreenshot()` and `browserInfo()` collect them; pass them to `send` only if the person agreed, otherwise `screenshot: null` and `browser: null`. Mark private regions `data-no-screenshot`. The screenshot needs the optional peer `modern-screenshot`; without it the result is `null`.

## Show messages as they are

`tidy`, `send` and `request` throw errors written for the person. Show `error.message`; do not replace it with a generic one.

## When it does not show

`enabled()` false: check `GET /relay/config` in the network tab. 404 means the mount is wrong; `enabled:false` means the server has no token or repo; a blocked request means CORS. It asks once, so reload after a fix.

## Reference

`docs/client.md`, `docs/http-api.md`.
