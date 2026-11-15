# @journey-to-code/relay

Let people report a bug or ask for a feature from inside your app, with no GitHub account. Your server turns what they send into an issue.

```sh
npm install @journey-to-code/relay
```

- **`@journey-to-code/relay/server`**: `createRelay({ token, repo, … })` files the issues, with limits, screenshots and escaping of what strangers write. Works with `fetch`-style servers and Node's `http`.
- **`@journey-to-code/relay/client`**: `createRelayClient()` gathers where the person was and the last few errors, and sends the report.
- **`@journey-to-code/relay/tidy`**: `createTidy(complete)` tidies a report with whichever model you already use.

The interface lives in [`@journey-to-code/relay-ui`](https://www.npmjs.com/package/@journey-to-code/relay-ui). The full guide, with options and examples, is in the [open.relay README](https://github.com/journey-to-code-org/open.relay#readme).

MIT licensed.
