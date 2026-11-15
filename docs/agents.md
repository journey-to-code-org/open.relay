---
order: 9
---

# For agents

A coding agent can use and maintain open.relay with the skills in [`.agents/`](https://github.com/journey-to-code-org/open.relay/tree/main/.agents). They are plain Markdown, in the `SKILL.md` format, so any agent that reads `AGENTS.md` or skills can use them, and a person can read them too.

[`AGENTS.md`](https://github.com/journey-to-code-org/open.relay/blob/main/AGENTS.md) at the root is the short version for anyone working in the repository: the layout, the commands, and the rules that are easy to break.

## The skills

| Skill | Use it to |
| --- | --- |
| `relay-server` | Add `createRelay` to a server: the token, mounting, identity and limits, the store, `enrich`, labels, and tidying with a model. |
| `relay-client` | Add the browser client: context, error capture, screenshots, and what must be asked before they are sent. |
| `relay-ui` | Put a report or request button in an interface: the React sheets, restyling, re-wording, swapping parts, or building your own on the flows. |
| `relay-maintain` | Work on this repository: tests, the docs, the Signals rule, and cutting a release. |

Each one says when to use it, the steps, and how to tell it worked. They are written for a project that already has a server and a front end, and say what to ask before guessing (where the server mounts, who identifies a person, which design system the sheets should match).

## Rules every skill repeats

- **The token stays on the server.** It is never put in a client, a bundle or an issue.
- **Nothing identifying goes in a public issue.** Not a name, an address, a cookie, or a `ref`. `enrich` lines are public.
- **A picture and browser details are the person's to allow**, separately, each time.
- **No Signals API.** See [What uses the Signals API](signals.md).

## Editing these docs

The docs are Markdown in `docs/`, read on GitHub or on the site, and built with [open.blog](https://github.com/journey-to-code-org/open.blog). Write a link to another page as its file (`[the server](server.md)`) so it works in both places.

To preview locally you need Rust and a checkout of open.blog (the build uses its themes):

```sh
git clone https://github.com/journey-to-code-org/open.blog .open.blog   # once; ignored by git
cargo build --release --manifest-path .open.blog/Cargo.toml -p openblog-cli
node scripts/build-docs-site.mjs                                      # copies docs/ into the site
.open.blog/target/release/openblog serve --root docs-site
```

Then open <http://localhost:8080/docs/>. `docs-pages.yml` builds the same way, pinned to one open.blog commit (the `OPENBLOG_REF` in that file), and publishes on every push to `main` that changes `docs/`.

To add a page, add a Markdown file to `docs/` with an `order` in its front matter, and link it from `README.md`.
