# @journey-to-code/relay-ui

The interface for [`@journey-to-code/relay`](https://www.npmjs.com/package/@journey-to-code/relay): framework-free flow controllers, React bindings, and default sheets you can restyle, re-word, or swap piece by piece.

```sh
npm install @journey-to-code/relay @journey-to-code/relay-ui
```

```tsx
import { createRelayClient } from "@journey-to-code/relay/client";
import { createReportFlow } from "@journey-to-code/relay-ui";
import { ReportButton, ReportSheet } from "@journey-to-code/relay-ui/react";
import "@journey-to-code/relay-ui/styles.css"; // optional

const report = createReportFlow(createRelayClient({ base: "/relay" }));

<ReportButton flow={report} />
<ReportSheet flow={report} />
```

Make it yours with `classes`, `copy` and `slots`, or build your own sheet on the flows (`getState` / `subscribe`). React is an optional peer dependency. The full guide is in the [open.relay README](https://github.com/journey-to-code-org/open.relay#readme).

MIT licensed.
