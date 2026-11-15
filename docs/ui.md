---
order: 4
---

# The interface

`@journey-to-code/relay-ui` has three layers, and you can stop at any of them.

| Import | What it gives you |
| --- | --- |
| `@journey-to-code/relay-ui` | The **flows**: plain objects that hold the state of "report a problem" and "ask for something". No framework in them. |
| `@journey-to-code/relay-ui/react` | **React bindings** and default sheets built on the flows. React is an optional peer dependency. |
| `@journey-to-code/relay-ui/styles.css` | Optional styles for the default sheets. |

## The default sheets

```tsx
import { createReportFlow, createRequestFlow } from "@journey-to-code/relay-ui";
import { ReportButton, ReportSheet, RequestButton, RequestSheet } from "@journey-to-code/relay-ui/react";
import "@journey-to-code/relay-ui/styles.css";

const report = createReportFlow(relay);
const request = createRequestFlow(relay, { findExisting: (name) => myCatalogue.find(name) });

<ReportButton flow={report} />
<ReportSheet flow={report} />
<RequestButton flow={request} />
<RequestSheet flow={request} renderExisting={(item) => <>Good news: {item.name} is already here.</>} />
```

Open the report sheet from anywhere, such as a crash screen, with `report.open()`.

## Making it yours

From lightest to heaviest. Each step replaces only what you name.

1. **CSS.** Every part is a `relay-*` class, and `styles.css` is themed with a few variables: `--relay-accent`, `--relay-bg`, `--relay-fg`, `--relay-muted`, `--relay-error` and `--relay-radius`. Or skip `styles.css` and write your own.
2. **`classes`.** If you already have styles for sheets, buttons and fields, point each part at your own class:

   ```tsx
   <ReportSheet flow={report} classes={{ sheet: "sheet", primary: "btn btn-primary" }} />
   ```

   The parts are `backdrop`, `sheet`, `form`, `field`, `choice`, `choices`, `shot`, `details`, `pre`, `error`, `fine`, `tidyNote`, `actions`, `primary`, `secondary`, `link` and `toggleButton`. Any you leave out keep the default `relay-*` class.
3. **`copy`.** Every word, one at a time:

   ```tsx
   <ReportSheet flow={report} copy={{ title: "Something broke?" }} />
   ```

   The defaults are exported from `@journey-to-code/relay-ui/react` as `reportCopy`, `requestCopy` and `tidyCopy`, so you can read every key.
4. **`slots`.** Swap the toggle and the text field for your design system's. Each takes plain props and a plain `onChange`:

   ```tsx
   import type { ToggleProps } from "@journey-to-code/relay-ui/react";
   import ToggleSwitch from "my-design-system/toggle-switch";

   const Toggle = ({ label, description, checked, onChange }: ToggleProps) => (
     <ToggleSwitch label={label} description={description} checked={checked} onCheckedChange={(e: CustomEvent<boolean>) => onChange(e.detail)} />
   );

   <ReportSheet flow={report} slots={{ Toggle }} />;
   ```

   `ToggleProps` and `TextFieldProps` are exported from `@journey-to-code/relay-ui/react`. `ToggleProps` is `{ label, description?, checked, onChange(checked) }`. `TextFieldProps` is `{ label, value, placeholder?, maxLength?, required?, onChange(value) }`.
5. **Your own sheet.** `useFlow(flow)` gives the state and the flow has every action. Read the next section.

## Flows

A flow is a plain object. Watch it from anything.

```ts
const report = createReportFlow(relay, { tidyFrom: 12 });

report.getState();             // { stage, enabled, … }
const stop = report.subscribe(() => render(report.getState()));
```

`createReportFlow` stages, in order: `closed`, `looking` (taking the picture, before the sheet appears so the sheet is not in it), `writing`, `tidying`, `review`, `sending`, `sent`.

Its actions:

| Action | Does |
| --- | --- |
| `load()` | Asks the server whether reporting (and tidying) is on. The default button and sheet call it for you. |
| `open()`, `close()` | Open the sheet (taking the picture first), or close it. |
| `setDescription(text)`, `setWithShot(bool)`, `setWithBrowser(bool)` | What the person typed, and their two yes-or-no answers. |
| `willTidy()` | Whether `next()` would tidy rather than send, so a button can say which. |
| `next()` | Tidies if there is a model and enough words, otherwise sends. |
| `send()` | Sends what is on the sheet. |
| `editDraft(change)` | Edits the tidied title and report during review. |
| `useOriginal()`, `useTidied()` | Put their own words back, or the model's suggestion. |
| `backToWriting()` | From review back to the words. |

Helpers decide what to show: `isShowing(state)`, `isReviewing(state)`, `isBusy(state)` and `titleOf(words)`. `tidyFrom` (default 12) is how short a report can be before there is nothing to tidy.

In React, `useFlow(flow)` returns the current state and re-renders on change, and `useEscape(active, close)` closes a sheet on Escape.

To drive a flow from Vue, Svelte, Solid, Angular or a web component, call `getState` and `subscribe` and render the stages yourself. That is all the React bindings do.

## Asking for something

`createRequestFlow(relay, { findExisting })` is the same idea for "ask for a thing". `findExisting(name)` returns your catalogue's entry when what they typed is already there; the flow then shows it instead of sending, and `canSubmit(state)` is false. Pass `renderExisting` to the sheet to word that message.

Its actions are `load`, `open`, `close`, `setName`, `setNote`, `next`, `send`, `editDraft`, `useOriginal`, `useTidied` and `backToWriting`, and `isRequestBusy(state)` says whether it is waiting.

When someone asks for something already requested, the server adds their voice as a comment on the open issue instead of filing a second one. The `again` field of the result says which happened.
