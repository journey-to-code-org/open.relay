# open.relay

Let people report a bug or ask for a feature from inside your app, with no GitHub account. Your server turns what they send into an issue.

These pages are also published at <https://journey-to-code-org.github.io/open.relay/>.

It began as the "Report a problem" and "Ask for a game" buttons of a card-game website, and was pulled out because it kept proving useful. Two packages:

| Package | What it is |
| --- | --- |
| [`@journey-to-code/relay`](https://www.npmjs.com/package/@journey-to-code/relay) | The server (files issues on GitHub), the client (gathers context, sends), and the optional model-tidying helper. No UI. |
| [`@journey-to-code/relay-ui`](https://www.npmjs.com/package/@journey-to-code/relay-ui) | The interface. Framework-free flow controllers; React bindings; default sheets you can restyle, re-word, or swap piece by piece. |

The UI is a separate package on purpose: use the defaults, extend them, or build your own sheets (Vue, Svelte, Solid, Angular, web components) on the same controllers.

## What a person sees

- A button opens a sheet. They write a line, or nothing.
- They say yes or no, separately, to a **picture of their screen** and to their **browser's details**. They can see exactly what would be sent.
- If you gave the server a model, **Next** shows them a tidied title and report to look over. They can edit it, put their own words back, or go back. Nothing is sent until they press Send, and their own words go along folded away.
- Asking for something works the same way. If someone already asked, their voice is added as a comment on the open issue, so the comment count says how many want it.

## What goes in the issue

Public issues need care, so the issue is built from as little as explains the problem: their words, which screen and scope they were on, the last few errors the page logged, the page's build, and only what they agreed to of the picture and browser details. Never their name, cookie or address.

Their text is escaped so it can't `@mention` anyone, reference other issues, inject HTML, or break out of a code block. Limits are per person and per day.

## Where to go next

- [Getting started](getting-started.md): both halves running in about ten minutes.
- [The server](server.md), [the client](client.md) and [the interface](ui.md): every option, in the order you will need them.
- [Try it](try-it.md): the button on these pages is open.relay, filing demo issues.
- [Tidying with a model](tidying.md): optional, and you bring the model.
- [The HTTP API](http-api.md): the routes, for a client in another language.
- [Releasing](releasing.md): how a version reaches npm.
- [For agents](agents.md): the skills in `.agents/` that let a coding agent use and maintain this.

## Status

Version 0.1, on npm. [MIT](https://github.com/journey-to-code-org/open.relay/blob/main/LICENSE).
