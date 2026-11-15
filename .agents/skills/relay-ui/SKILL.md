---
name: relay-ui
description: Put an open.relay report or request button in an interface. Use when adding ReportButton or RequestButton, restyling or rewording the sheets, swapping their toggle or text field for a design system, or building a sheet in another framework from the flows.
---

`@journey-to-code/relay-ui` has flows (plain state objects), optional React sheets built on them, and optional CSS. It needs a client from `relay-client`.

## Ask first

- What framework is the app in? React gets ready-made sheets. Anything else drives the flows itself.
- Is there a design system? If so, use `classes` and `slots` so the sheets match it, rather than shipping `styles.css`.

## Steps

1. `npm install @journey-to-code/relay-ui` (React and `modern-screenshot` are optional peers).
2. React:

   ```tsx
   import { createReportFlow } from "@journey-to-code/relay-ui";
   import { ReportButton, ReportSheet } from "@journey-to-code/relay-ui/react";
   import "@journey-to-code/relay-ui/styles.css";

   const report = createReportFlow(relay); // once, outside components
   <ReportButton flow={report} />
   <ReportSheet flow={report} />
   ```

   For asking for something, use `createRequestFlow(relay, { findExisting })` with `RequestButton` and `RequestSheet`.
3. Check: the button appears only when `GET /relay/config` says enabled; opening it shows the sheet; sending shows the issue number.

## Changing it, lightest first

1. CSS variables: `--relay-accent`, `--relay-bg`, `--relay-fg`, `--relay-muted`, `--relay-error`, `--relay-radius`.
2. `classes={{ sheet, primary, … }}` to use the app's own classes. Unlisted parts keep `relay-*`.
3. `copy={{ title: "…" }}` for words (`reportCopy`, `requestCopy`, `tidyCopy` from `/react` list every key).
4. `slots={{ Toggle, TextField }}` to swap parts. Props are plain: `{ label, description?, checked, onChange(checked) }` and `{ label, value, placeholder?, maxLength?, required?, onChange(value) }`.
5. Your own sheet: `useFlow(flow)` for the state, the flow's methods for actions. In other frameworks use `flow.getState()` and `flow.subscribe(fn)`.

## Do not

- Open a report sheet before the flow has taken its picture; use `flow.open()`, which does it in order.
- Pre-tick the screenshot or browser-details choice to hide it. They are the person's to allow.

## Reference

`docs/ui.md`.
