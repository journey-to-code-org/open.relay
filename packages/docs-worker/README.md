# open.relay-docs-worker

The Cloudflare Worker behind the **Report a problem** button on the open.relay docs site. Private: it is not published to npm. See [docs/try-it.md](../../docs/try-it.md).

```sh
npm run test -w open.relay-docs-worker      # the handler, with a fake GitHub
cd packages/docs-worker
npx wrangler deploy
npx wrangler secret put GITHUB_TOKEN        # fine-grained, Issues: read and write, on REPO only
```

Then put the Worker's address in `docs-site/openblog.json`, in the script tag's `data-relay`.
