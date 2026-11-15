---
order: 5
---

# Tidying with a model

Optional. When you give the server a model, a person who writes "it broke when i hit apply" can review a tidied title and a short report before sending, and can put their own words back. **You bring the model; relay never talks to one itself.**

```ts
import { createRelay } from "@journey-to-code/relay/server";
import { createTidy } from "@journey-to-code/relay/tidy";

const relay = createRelay({
  token: process.env.GITHUB_TOKEN,
  repo: "you/your-app",
  tidy: createTidy((system, user) => askMyModel(system, user), {
    app: "a family card-game website",
    asking: "a game the website doesn't have yet",
    nameHint: "the game's usual name, spelled properly in Title Case",
  }),
});
```

`askMyModel(system, user)` takes the two prompts and returns the model's text answer as a string. Any provider works.

## The options

| Option | Default | Use |
| --- | --- | --- |
| `app` | `"an app"` | What the person is using, in a phrase. |
| `asking` | `"a feature the app doesn't have yet"` | What a request is for, as the model should read it. |
| `nameHint` | a Title Case name under 40 characters | How a request's name should be written. |

## What happens

- The person's text goes to the model **as data, not as instructions**, and the model is asked to answer only JSON: `{"title", "report"}` for a bug, `{"name", "note"}` for a request.
- The answer is parsed and checked. If it is not the JSON asked for, or your function throws, the person is told ("You can send it in your own words") and sends what they wrote. Tidying never blocks a report.
- **There is no time limit on your function.** A slow model keeps the person waiting on "Tidying…", so give your call its own, such as `AbortSignal.timeout(20_000)` on the request to the provider. A timeout that throws is handled like any other failure.
- A report of fewer than 12 characters is not tidied: there is nothing to tidy, and `POST /tidy` answers 400.
- The person always sees the tidied version before anything is sent, and can edit it. Their own words are sent along too, folded away in the issue.
- A person may ask for `tidies` tidy-ups (default 8) every ten minutes.

## What your model sees

The person's description and, for a bug, the screen and scope. Not their picture, browser details, errors, `ref` or identity. Tell your own users that their words go to the model provider you chose.

## Your own prompts

`createTidy` is built from two exported pieces, if you need to change more than the three options:

```ts
import { tidyPrompt, parseTidy } from "@journey-to-code/relay/tidy";

const { system, user } = tidyPrompt({ kind: "bug", description }, { app: "…" });
const tidied = parseTidy("bug", await askMyModel(system, user)); // Tidied | null
```

`tidy` on `createRelay` is any `(input) => Promise<Tidied | null>`, so you can also write it directly.
