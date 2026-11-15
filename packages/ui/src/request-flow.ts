// "Make a request" as a flow with no screen of its own: a name and, if they like, a note. When the
// server can tidy, "Next" first tidies it (the proper name, a short note) for them to look over.
//
// `findExisting` is yours: when what they ask for is already there (a game you already have, a feature
// that already exists), return it and the flow won't send, so the sheet can say "it's already here".
import type { RelayClient, SentRequest } from "@journey-to-code/relay/client";
import { createStore, type Watchable } from "./store.js";

export interface RequestDraft {
  name: string;
  note: string;
  /** What the model suggested, to go back to; null when tidying didn't work. */
  tidied: { name: string; note: string } | null;
  /** What the person wrote. */
  original: { name: string; note: string };
}

export interface RequestState<E = never> {
  enabled: boolean;
  canTidy: boolean;
  open: boolean;
  name: string;
  note: string;
  sending: boolean;
  tidying: boolean;
  draft: RequestDraft | null;
  sent: (SentRequest & { name: string }) | null;
  problem: string | null;
  /** What `findExisting` found for the name as it stands (the draft's, when there is one). */
  existing: E | undefined;
}

export interface RequestFlowOptions<E> {
  findExisting?: (name: string) => E | undefined;
}

export type RequestClient = Pick<RelayClient, "enabled" | "canTidy" | "tidy" | "request">;

/** Whether the request can be sent now: it has a name, isn't already here, and nothing is in flight. */
export const canSubmit = (s: RequestState<unknown>) => (s.draft ? s.draft.name : s.name).trim() !== "" && s.existing === undefined && !s.sending && !s.tidying;
export const isRequestBusy = (s: RequestState<unknown>) => s.sending || s.tidying;

export function createRequestFlow<E = never>(client: RequestClient, options: RequestFlowOptions<E> = {}) {
  const find = (name: string) => (name.trim() ? options.findExisting?.(name) : undefined);
  const store = createStore<RequestState<E>>({
    enabled: false,
    canTidy: false,
    open: false,
    name: "",
    note: "",
    sending: false,
    tidying: false,
    draft: null,
    sent: null,
    problem: null,
    existing: undefined,
  });
  const { getState, setState } = store;

  let loading: Promise<void> | null = null;
  /** Ask the server whether it takes requests, and tidies them. Once; safe to call again. */
  const load = () => (loading ??= Promise.all([client.enabled(), client.canTidy()]).then(([enabled, canTidy]) => setState({ enabled, canTidy })));

  const open = () => setState({ sent: null, problem: null, draft: null, open: true, existing: find(getState().name) });
  const close = () => setState({ open: false });

  async function send() {
    const s = getState();
    setState({ problem: null, sending: true });
    try {
      const name = (s.draft ? s.draft.name : s.name).trim();
      const sent = await (s.draft ? client.request(name, s.draft.note.trim(), s.draft.original) : client.request(name, s.note.trim()));
      setState({ sent: { ...sent, name }, name: "", note: "", draft: null, existing: undefined });
    } catch (e) {
      setState({ problem: (e as Error).message });
    }
    setState({ sending: false });
  }

  /** "Next": tidy the request first when the server can, else send it as it is. */
  async function next() {
    const s = getState();
    if (!s.canTidy) return send();
    const original = { name: s.name.trim(), note: s.note.trim() };
    setState({ problem: null, tidying: true });
    let tidied: RequestDraft["tidied"] = null;
    try {
      const t = await client.tidy({ kind: "request", ...original });
      if (t.kind === "request") tidied = { name: t.name, note: t.note };
    } catch {
      // Their own words, then: the review says so.
    }
    const shown = tidied ?? original;
    setState({ tidying: false, draft: { ...shown, tidied, original }, existing: find(shown.name) });
  }

  const editDraft = (change: Partial<Pick<RequestDraft, "name" | "note">>) =>
    setState((s) => (s.draft ? { draft: { ...s.draft, ...change }, existing: change.name !== undefined ? find(change.name) : s.existing } : {}));
  return {
    getState,
    subscribe: store.subscribe,
    load,
    open,
    close,
    setName: (name: string) => setState({ name, existing: find(name) }),
    setNote: (note: string) => setState({ note }),
    next,
    send,
    editDraft,
    /** Put the person's own words back. */
    useOriginal: () => setState((s) => (s.draft ? { draft: { ...s.draft, ...s.draft.original }, existing: find(s.draft.original.name) } : {})),
    /** Back to what the model suggested. */
    useTidied: () => setState((s) => (s.draft?.tidied ? { draft: { ...s.draft, ...s.draft.tidied }, existing: find(s.draft.tidied.name) } : {})),
    /** From the review, back to the words they wrote. */
    backToWriting: () =>
      setState((s) => (s.draft ? { name: s.draft.original.name, note: s.draft.original.note, draft: null, existing: find(s.draft.original.name) } : {})),
  };
}

export type RequestFlow<E = never> = ReturnType<typeof createRequestFlow<E>> & Watchable<RequestState<E>>;
