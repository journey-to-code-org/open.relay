// "Report a problem": a small button, and the sheet it opens. The person writes a line (or nothing),
// says yes or no to a picture of the screen and to their browser's details, and sends. With a tidying
// server, "Next" shows them the tidied version to look over first.
//
// Everything is yours to change: `copy` for the words, `slots` for the toggle and the text field, CSS
// for the rest (or none: see styles.css), and `useFlow(flow)` to build a different sheet entirely.
import { browserLines } from "@journey-to-code/relay/client";
import { useEffect, useRef, type ReactNode } from "react";
import { isBusy, isReviewing, isShowing, titleOf, type ReportFlow } from "../report-flow.js";
import { defaultClasses, type Classes } from "./classes.js";
import { reportCopy, type ReportCopy } from "./copy.js";
import { defaultSlots, type Slots } from "./slots.js";
import { TidyNote } from "./TidyNote.js";
import { useEscape, useFlow } from "./use-flow.js";

const DESCRIPTION_LIMIT = 2000;
const TITLE_LIMIT = 90;

interface Props {
  flow: ReportFlow;
  copy?: Partial<ReportCopy>;
  slots?: Partial<Slots>;
  /** Your own classes for the parts of the sheet. */
  classes?: Partial<Classes>;
}

/** The button that opens the sheet. Shows nothing until the server says reporting is on, nor while the sheet is open. */
export function ReportButton({ flow, copy: given, children, className }: { flow: ReportFlow; copy?: Partial<ReportCopy>; children?: ReactNode; className?: string }) {
  const s = useFlow(flow);
  const copy = { ...reportCopy, ...given };
  useEffect(() => void flow.load(), [flow]);
  if (!s.enabled || isShowing(s)) return null;
  return (
    // Never in its own picture.
    <button type="button" className={className ?? defaultClasses.toggleButton} data-no-screenshot onClick={() => void flow.open()} disabled={s.stage === "looking"} aria-label={copy.open} title={copy.open}>
      {children ?? <span aria-hidden>{s.stage === "looking" ? "…" : "🐞"}</span>}
    </button>
  );
}

export function ReportSheet({ flow, copy: given, slots: givenSlots, classes }: Props) {
  const s = useFlow(flow);
  const c = { ...defaultClasses, ...classes };
  const copy = { ...reportCopy, ...given };
  const { Toggle } = { ...defaultSlots, ...givenSlots };
  const words = useRef<HTMLTextAreaElement>(null);
  useEffect(() => void flow.load(), [flow]);
  useEscape(isShowing(s), flow.close);
  useEffect(() => {
    if (s.stage === "writing") words.current?.focus();
  }, [s.stage]);

  if (!s.enabled || !isShowing(s)) return null;

  const busy = isBusy(s);
  const reviewing = isReviewing(s);
  const { draft } = s;
  const browser = s.withBrowser && s.browser ? browserLines(s.browser) : null;

  return (
    <div data-no-screenshot>
      <div className={c.backdrop} onClick={busy ? undefined : flow.close} />
      <div className={c.sheet} role="dialog" aria-modal="true" aria-labelledby="relay-report-title">
        {s.stage === "sent" && s.sent ? (
          <>
            <h2 id="relay-report-title">{copy.sentTitle}</h2>
            <p>
              {copy.sentBody(s.sent.number)}
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
            <button type="button" className={c.primary} onClick={flow.close}>
              {copy.done}
            </button>
          </>
        ) : reviewing && draft ? (
          <form
            className={c.form}
            onSubmit={(e) => {
              e.preventDefault();
              void flow.send();
            }}
          >
            <h2 id="relay-report-title">{copy.reviewTitle}</h2>
            <TidyNote tidied={draft.tidied !== null} what="report" classes={c} />
            <label className={c.field}>
              <span>{copy.reviewTitleField}</span>
              <input type="text" maxLength={TITLE_LIMIT} value={draft.title} onChange={(e) => flow.editDraft({ title: e.target.value })} />
            </label>
            <label className={c.field}>
              <span>{copy.reviewWords}</span>
              <textarea rows={6} maxLength={DESCRIPTION_LIMIT} value={draft.report} onChange={(e) => flow.editDraft({ report: e.target.value })} />
            </label>
            <div className={c.choices}>
              <button type="button" className={c.link} disabled={draft.report === draft.original && draft.title === titleOf(draft.original)} onClick={flow.useOriginal}>
                {copy.useOriginal}
              </button>
              {draft.tidied && (draft.report !== draft.tidied.report || draft.title !== draft.tidied.title) && (
                <button type="button" className={c.link} onClick={flow.useTidied}>
                  {copy.useTidied}
                </button>
              )}
            </div>
            <details className={c.details}>
              <summary>{copy.seeWhatsSent}</summary>
              <dl>
                <div>
                  <dt>{copy.reviewTitleField}</dt>
                  <dd>{draft.title.trim() || titleOf(draft.report) || "—"}</dd>
                </div>
                <div>
                  <dt>{copy.reviewWords}</dt>
                  <dd className={c.pre}>{draft.report.trim() || "—"}</dd>
                </div>
                {draft.report.trim() !== draft.original && (
                  <div>
                    <dt>{copy.yourOwnWords}</dt>
                    <dd className={c.pre}>{draft.original}</dd>
                  </div>
                )}
                <div>
                  <dt>{copy.shotLabel}</dt>
                  <dd>{s.withShot && s.shot ? "yes" : "no"}</dd>
                </div>
                {browser ? (
                  browser.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))
                ) : (
                  <div>
                    <dt>{copy.browserLabel}</dt>
                    <dd>no</dd>
                  </div>
                )}
              </dl>
            </details>
            {s.problem && (
              <p className={c.error} role="alert">
                {s.problem}
              </p>
            )}
            <div className={c.actions}>
              <button type="button" className={c.secondary} onClick={flow.backToWriting} disabled={busy}>
                {copy.back}
              </button>
              <button type="submit" className={c.primary} disabled={busy}>
                {s.stage === "sending" ? copy.sending : copy.sendReport}
              </button>
            </div>
          </form>
        ) : (
          <form
            className={c.form}
            onSubmit={(e) => {
              e.preventDefault();
              void flow.next();
            }}
          >
            <h2 id="relay-report-title">{copy.title}</h2>
            <label className={c.field}>
              <span>
                {copy.words} <small>{copy.wordsOptional}</small>
              </span>
              <textarea ref={words} rows={3} maxLength={DESCRIPTION_LIMIT} value={s.description} placeholder={copy.placeholder} onChange={(e) => flow.setDescription(e.target.value)} />
            </label>

            {s.shot ? (
              <div className={c.choice}>
                <Toggle label={copy.shotLabel} description={copy.shotDescription} checked={s.withShot} onChange={flow.setWithShot} />
                {s.withShot && <img className={c.shot} src={s.shot} alt={copy.shotAlt} />}
              </div>
            ) : (
              <p className={c.fine}>{copy.noShot}</p>
            )}

            <div className={c.choice}>
              <Toggle label={copy.browserLabel} description={copy.browserDescription} checked={s.withBrowser} onChange={flow.setWithBrowser} />
              {browser && (
                <details className={c.details}>
                  <summary>{copy.seeWhatsSent}</summary>
                  <dl>
                    {browser.map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </div>

            <p className={c.fine}>
              {copy.finePrint}
              {s.canTidy && copy.tidyNext}
            </p>
            {s.problem && (
              <p className={c.error} role="alert">
                {s.problem}
              </p>
            )}
            <div className={c.actions}>
              <button type="button" className={c.secondary} onClick={flow.close} disabled={busy}>
                {copy.cancel}
              </button>
              <button type="submit" className={c.primary} disabled={busy}>
                {s.stage === "sending" ? copy.sending : s.stage === "tidying" ? copy.tidying : flow.willTidy() ? copy.next : copy.send}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
