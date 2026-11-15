// "Make a request": a button, and the sheet it opens. A name and, if they like, a note. With a tidying
// server, "Next" shows them the tidied version to look over first.
//
// `existing` is whatever your flow's `findExisting` found for the name: show them it's already here
// with `renderExisting`, and the flow won't send.
import { useEffect, type ReactNode } from "react";
import { canSubmit, isRequestBusy, type RequestFlow } from "../request-flow.js";
import { requestCopy, type RequestCopy } from "./copy.js";
import { defaultSlots, type Slots } from "./slots.js";
import { TidyNote } from "./TidyNote.js";
import { useEscape, useFlow } from "./use-flow.js";

const NOTE_LIMIT = 600;
const NAME_LIMIT = 60;

interface Props<E> {
  flow: RequestFlow<E>;
  copy?: Partial<RequestCopy>;
  slots?: Partial<Slots>;
  /** What to show when `findExisting` found something: "Good news: it's already here." */
  renderExisting?: (existing: E) => ReactNode;
}

/** The button that opens the sheet. Shows nothing until the server says requests are on. */
export function RequestButton<E>({ flow, label = "Make a request", children, className }: { flow: RequestFlow<E>; label?: string; children?: ReactNode; className?: string }) {
  const s = useFlow(flow);
  useEffect(() => void flow.load(), [flow]);
  if (!s.enabled) return null;
  return (
    <button type="button" className={className ?? "relay-link"} data-no-screenshot onClick={flow.open}>
      {children ?? label}
    </button>
  );
}

export function RequestSheet<E = never>({ flow, copy: given, slots: givenSlots, renderExisting }: Props<E>) {
  const s = useFlow(flow);
  const copy = { ...requestCopy, ...given };
  const { TextField } = { ...defaultSlots, ...givenSlots };
  useEffect(() => void flow.load(), [flow]);
  useEscape(s.open, flow.close);

  if (!s.enabled || !s.open) return null;

  const busy = isRequestBusy(s);
  const { draft } = s;
  const existing = s.existing !== undefined && renderExisting ? <p>{renderExisting(s.existing)}</p> : null;
  const nameLabel = copy.nameLabel;

  return (
    <div data-no-screenshot>
      <div className="relay-backdrop" onClick={busy ? undefined : flow.close} />
      <div className="relay-sheet" role="dialog" aria-modal="true" aria-labelledby="relay-request-title">
        {s.sent ? (
          <>
            <h2 id="relay-request-title">{s.sent.again ? copy.againTitle : copy.sentTitle}</h2>
            <p>
              {copy.sentBody(s.sent.name, s.sent.number, s.sent.again)}
              {s.sent.url && (
                <>
                  {" "}
                  <a href={s.sent.url} target="_blank" rel="noreferrer">
                    {copy.follow}
                  </a>
                  .
                </>
              )}
            </p>
            <button type="button" className="relay-primary" onClick={flow.close}>
              {copy.done}
            </button>
          </>
        ) : draft ? (
          <form
            className="relay-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit(s)) void flow.send();
            }}
          >
            <h2 id="relay-request-title">{copy.reviewTitle}</h2>
            <TidyNote tidied={draft.tidied !== null} what="request" />
            <TextField label={nameLabel} required maxLength={NAME_LIMIT} value={draft.name} onChange={(name) => flow.editDraft({ name })} />
            {existing}
            <label className="relay-field">
              <span>{copy.tidyNote}</span>
              <textarea rows={3} maxLength={NOTE_LIMIT} value={draft.note} onChange={(e) => flow.editDraft({ note: e.target.value })} />
            </label>
            <div className="relay-choices">
              <button type="button" className="relay-link" disabled={draft.name === draft.original.name && draft.note === draft.original.note} onClick={flow.useOriginal}>
                {copy.useOriginal}
              </button>
              {draft.tidied && (draft.name !== draft.tidied.name || draft.note !== draft.tidied.note) && (
                <button type="button" className="relay-link" onClick={flow.useTidied}>
                  {copy.useTidied}
                </button>
              )}
            </div>
            <details className="relay-details">
              <summary>{copy.seeWhatsSent}</summary>
              <dl>
                <div>
                  <dt>{nameLabel}</dt>
                  <dd>{draft.name.trim()}</dd>
                </div>
                <div>
                  <dt>{copy.tidyNote}</dt>
                  <dd className="relay-pre">{draft.note.trim() || copy.noNote}</dd>
                </div>
                {(draft.name.trim() !== draft.original.name || draft.note.trim() !== draft.original.note) && (
                  <div>
                    <dt>{copy.yourOwnWords}</dt>
                    <dd className="relay-pre">{[draft.original.name, draft.original.note].filter(Boolean).join("\n\n")}</dd>
                  </div>
                )}
              </dl>
            </details>
            {s.problem && (
              <p className="relay-error" role="alert">
                {s.problem}
              </p>
            )}
            <div className="relay-actions">
              <button type="button" className="relay-secondary" disabled={busy} onClick={flow.backToWriting}>
                {copy.back}
              </button>
              <button type="submit" className="relay-primary" disabled={!canSubmit(s)}>
                {s.sending ? copy.sending : copy.sendRequest}
              </button>
            </div>
          </form>
        ) : (
          <form
            className="relay-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit(s)) void flow.next();
            }}
          >
            <h2 id="relay-request-title">{copy.title}</h2>
            <TextField label={nameLabel} required maxLength={NAME_LIMIT} value={s.name} placeholder={copy.namePlaceholder} onChange={flow.setName} />
            {existing}
            <label className="relay-field">
              <span>
                {copy.noteLabel} <small>{copy.noteOptional}</small>
              </span>
              <textarea rows={3} maxLength={NOTE_LIMIT} value={s.note} placeholder={copy.notePlaceholder} onChange={(e) => flow.setNote(e.target.value)} />
            </label>
            <p className="relay-fine">{copy.finePrint}</p>
            {s.problem && (
              <p className="relay-error" role="alert">
                {s.problem}
              </p>
            )}
            <div className="relay-actions">
              <button type="button" className="relay-secondary" onClick={flow.close} disabled={busy}>
                {copy.cancel}
              </button>
              <button type="submit" className="relay-primary" disabled={!canSubmit(s)}>
                {s.sending ? copy.sending : s.tidying ? copy.tidying : s.canTidy ? copy.next : copy.send}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
