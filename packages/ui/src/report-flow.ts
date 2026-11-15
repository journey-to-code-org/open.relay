// "Report a problem" as a flow with no screen of its own. The person writes a line (or nothing), says
// yes or no to a picture of the screen and to their browser's details, and sends. When the server can
// tidy, "Next" first tidies their words into a title and a concise report; they look it over (change
// it, put their own words back, or go back) before anything is sent.
//
//   closed → looking (taking the picture while the screen still shows the problem)
//          → writing → tidying → review ─┐
//          └──────────→ sending ←────────┘ → sent        (a failed send returns to where it came from)
import type { BrowserInfo, RelayClient, SentReport } from "@journey-to-code/relay/client";
import { createStore, type Watchable } from "./store.js";

export type ReportStage = "closed" | "looking" | "writing" | "tidying" | "review" | "sending" | "sent";

/** The report as it will go, after a tidy-up: what the person can still change. */
export interface ReportDraft {
  title: string;
  report: string;
  /** What the model suggested, to go back to; null when tidying didn't work. */
  tidied: { title: string; report: string } | null;
  /** What the person wrote, sent along folded away (and theirs to put back). */
  original: string;
}

export interface ReportState {
  /** Whether the server takes reports at all (false until it has said so). */
  enabled: boolean;
  canTidy: boolean;
  stage: ReportStage;
  /** While sending: the step it was sent from, and where a failure returns to. */
  sendingFrom: "writing" | "review";
  description: string;
  shot: string | null;
  withShot: boolean;
  browser: BrowserInfo | null;
  withBrowser: boolean;
  problem: string | null;
  draft: ReportDraft | null;
  sent: SentReport | null;
}

export interface ReportFlowOptions {
  /** Shorter than this, there's nothing to tidy. Default 12. */
  tidyFrom?: number;
}

/** The title a report gets from the person's own words: its first line. */
export const titleOf = (words: string) => {
  const first = words.trim().split("\n")[0]!.trim();
  return first.length > 80 ? `${first.slice(0, 79).trimEnd()}…` : first;
};

/** Whether the sheet is on screen. (While `looking` it isn't yet: the picture is of the page, not the sheet.) */
export const isShowing = (s: ReportState) => s.stage !== "closed" && s.stage !== "looking";
/** Looking over the tidied report, including while it is being sent. */
export const isReviewing = (s: ReportState) => s.stage === "review" || (s.stage === "sending" && s.sendingFrom === "review");
/** Waiting on something: the sheet shouldn't be dismissed, and its buttons are off. */
export const isBusy = (s: ReportState) => s.stage === "looking" || s.stage === "tidying" || s.stage === "sending";

export type ReportClient = Pick<RelayClient, "enabled" | "canTidy" | "tidy" | "send" | "browserInfo" | "takeScreenshot">;

export function createReportFlow(client: ReportClient, options: ReportFlowOptions = {}) {
  const tidyFrom = options.tidyFrom ?? 12;
  const store = createStore<ReportState>({
    enabled: false,
    canTidy: false,
    stage: "closed",
    sendingFrom: "writing",
    description: "",
    shot: null,
    withShot: true,
    browser: null,
    withBrowser: true,
    problem: null,
    draft: null,
    sent: null,
  });
  const { getState, setState } = store;

  let loading: Promise<void> | null = null;
  /** Ask the server whether to offer reporting at all, and tidying. Once; safe to call again. */
  const load = () =>
    (loading ??= Promise.all([client.enabled(), client.canTidy()]).then(([enabled, canTidy]) => setState({ enabled, canTidy })));

  /** Open the sheet. The picture is taken first, while the screen still shows the problem and not the sheet. */
  async function open() {
    await load();
    const s = getState();
    if (!s.enabled || s.stage !== "closed") return;
    setState({ problem: null, stage: "looking", browser: client.browserInfo() });
    const shot = await client.takeScreenshot();
    // They may have closed it while the picture was being taken.
    if (getState().stage === "looking") setState({ shot, stage: "writing" });
  }
  const close = () => setState({ stage: "closed", shot: null, problem: null, draft: null });

  async function send() {
    const s = getState();
    const from = isReviewing(s) && s.draft ? "review" : "writing";
    setState({ problem: null, stage: "sending", sendingFrom: from });
    try {
      const words = from === "review" && s.draft ? { description: s.draft.report.trim(), title: s.draft.title.trim() || undefined, original: s.draft.original } : { description: s.description.trim() };
      const sent = await client.send({ ...words, screenshot: s.withShot ? s.shot : null, browser: s.withBrowser ? s.browser : null });
      setState({ description: "", draft: null, shot: null, stage: "sent", sent });
    } catch (e) {
      setState({ problem: (e as Error).message, stage: from });
    }
  }

  /** "Send" from the first step: tidy the words first when the server can, else send them as they are. */
  async function next() {
    const s = getState();
    const mine = s.description.trim();
    if (!s.canTidy || mine.length < tidyFrom) return send();
    setState({ problem: null, stage: "tidying" });
    let tidied: ReportDraft["tidied"] = null;
    try {
      const t = await client.tidy({ kind: "bug", description: mine });
      if (t.kind === "bug") tidied = { title: t.title, report: t.report };
    } catch {
      // Their own words, then: the review says so.
    }
    setState({ draft: { title: tidied?.title ?? titleOf(mine), report: tidied?.report ?? mine, tidied, original: mine }, stage: "review" });
  }

  const editDraft = (change: Partial<Pick<ReportDraft, "title" | "report">>) => setState((s) => (s.draft ? { draft: { ...s.draft, ...change } } : {}));
  return {
    getState,
    subscribe: store.subscribe,
    load,
    open,
    close,
    setDescription: (description: string) => setState({ description }),
    setWithShot: (withShot: boolean) => setState({ withShot }),
    setWithBrowser: (withBrowser: boolean) => setState({ withBrowser }),
    next,
    send,
    /** Whether "Next" would tidy what is written now, rather than send it: the sheet's button says which. */
    willTidy: () => getState().canTidy && getState().description.trim().length >= tidyFrom,
    editDraft,
    /** Put the person's own words back, title and all. */
    useOriginal: () => setState((s) => (s.draft ? { draft: { ...s.draft, title: titleOf(s.draft.original), report: s.draft.original } } : {})),
    /** Back to what the model suggested. */
    useTidied: () => setState((s) => (s.draft?.tidied ? { draft: { ...s.draft, ...s.draft.tidied } } : {})),
    /** From the review, back to the words. */
    backToWriting: () => setState({ stage: "writing", problem: null }),
  };
}

export type ReportFlow = ReturnType<typeof createReportFlow> & Watchable<ReportState>;
