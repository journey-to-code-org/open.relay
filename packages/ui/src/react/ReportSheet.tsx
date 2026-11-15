// "Report a problem", on every screen: a small button, and the sheet it opens. The player writes a
// line (or nothing), says yes or no to a picture of the screen and to their browser's details, and
// sends. The card room files it on GitHub for them; they never leave the page.
//
// When the card room has an AI key, "Send" first tidies their words: a title and a concise report for
// the developers. They look it over (and can change it, or put their own words back) before it goes.
import ToggleSwitch from "@spades/ui/zubra-ui/toggle-switch.zb";
import { useEffect, useRef, useState } from "react";
import { browserInfo, browserLines, bugs, openReport, REPORT_EVENT, takeScreenshot, type BrowserInfo, type SentReport } from "./bugReport";
import { TidyNote, useTidy } from "./Tidy";

const DESCRIPTION_LIMIT = 2000;
const TITLE_LIMIT = 90;
/** Shorter than this, there's nothing to tidy. */
const TIDY_FROM = 12;
/** The title a report gets from the player's own words: its first line. */
const titleOf = (words: string) => {
  const first = words.trim().split("\n")[0]!.trim();
  return first.length > 80 ? `${first.slice(0, 79).trimEnd()}…` : first;
};

/** Whether this card room takes reports (false until the server has said so). */
export function useReports() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => void bugs.enabled().then(setEnabled), []);
  return enabled;
}

/**
 * "Report a problem" as a line in another sheet (a table's ⚙︎, where a phone has no spare corner for
 * the button). `before` closes that sheet, so the picture is of the table and not of the settings.
 */
export function ReportLink({ before }: { before: () => void }) {
  if (!useReports()) return null;
  return (
    <button
      type="button"
      className="link report-link"
      onClick={() => {
        before();
        // Once the sheet has left the screen.
        setTimeout(openReport, 60);
      }}
    >
      🐞 Something not working? Report a problem
    </button>
  );
}

type Stage =
  | { kind: "closed" }
  | { kind: "looking" }
  | { kind: "writing" }
  | { kind: "tidying" }
  /** Looking over the tidied report before it goes. */
  | { kind: "review" }
  | { kind: "sending"; from: "writing" | "review" }
  | { kind: "sent"; report: SentReport };

/** The report as it will go, after a tidy-up: what the player can still change. */
interface Draft {
  title: string;
  report: string;
  /** What the AI suggested, to go back to; null when tidying didn't work. */
  tidied: { title: string; report: string } | null;
  /** What the player wrote, sent along folded away (and theirs to put back). */
  original: string;
}

export function ReportProblem() {
  const enabled = useReports();
  const [stage, setStage] = useState<Stage>({ kind: "closed" });
  const [description, setDescription] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [withShot, setWithShot] = useState(true);
  const [browser, setBrowser] = useState<BrowserInfo | null>(null);
  const [withBrowser, setWithBrowser] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const canTidy = useTidy();
  const words = useRef<HTMLTextAreaElement>(null);
  const busy = useRef(false);

  /** Take the picture first, while the screen still shows the problem and not this sheet. */
  const start = async () => {
    if (busy.current) return;
    busy.current = true;
    setProblem(null);
    setStage({ kind: "looking" });
    setBrowser(browserInfo());
    setShot(await takeScreenshot());
    setStage({ kind: "writing" });
    busy.current = false;
  };
  const close = () => {
    setStage({ kind: "closed" });
    setShot(null);
    setProblem(null);
    setDraft(null);
  };

  // Another part of the app can open the sheet (the screen shown after a crash).
  const open = useRef(start);
  open.current = start;
  useEffect(() => {
    const ask = () => void open.current();
    addEventListener(REPORT_EVENT, ask);
    return () => removeEventListener(REPORT_EVENT, ask);
  }, []);

  const showing = stage.kind !== "closed" && stage.kind !== "looking";
  useEffect(() => {
    if (!showing) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [showing]);
  useEffect(() => {
    if (stage.kind === "writing") words.current?.focus();
  }, [stage.kind]);

  if (!enabled) return null;

  const reviewing = stage.kind === "review" || (stage.kind === "sending" && stage.from === "review");
  const send = async () => {
    const from = reviewing && draft ? "review" : "writing";
    setProblem(null);
    setStage({ kind: "sending", from });
    try {
      const words = from === "review" && draft ? { description: draft.report.trim(), title: draft.title.trim() || undefined, original: draft.original } : { description: description.trim() };
      const report = await bugs.send({ ...words, screenshot: withShot ? shot : null, browser: withBrowser ? browser : null });
      setDescription("");
      setDraft(null);
      setShot(null);
      setStage({ kind: "sent", report });
    } catch (e) {
      setProblem((e as Error).message);
      setStage({ kind: from });
    }
  };

  /** "Send" from the first step: tidy the words first when the card room can, else send them as they are. */
  const next = async () => {
    const mine = description.trim();
    if (!canTidy || mine.length < TIDY_FROM) return send();
    setProblem(null);
    setStage({ kind: "tidying" });
    let tidied: Draft["tidied"] = null;
    try {
      const t = await bugs.tidy({ kind: "bug", description: mine });
      if (t.kind === "bug") tidied = { title: t.title, report: t.report };
    } catch {
      // Their own words, then: the review says so.
    }
    setDraft({ title: tidied?.title ?? titleOf(mine), report: tidied?.report ?? mine, tidied, original: mine });
    setStage({ kind: "review" });
  };

  return (
    // Never in its own picture.
    <div data-no-screenshot>
      {!showing && (
        <button type="button" className="report-toggle" onClick={start} disabled={stage.kind === "looking"} aria-label="Report a problem" title="Report a problem">
          <span aria-hidden>{stage.kind === "looking" ? "…" : "🐞"}</span>
        </button>
      )}
      {showing && (
        <>
          <div className="sheet-backdrop report-backdrop" onClick={stage.kind === "sending" || stage.kind === "tidying" ? undefined : close} />
          <div className="sheet report-sheet" role="dialog" aria-modal="true" aria-labelledby="report-title">
            {stage.kind === "sent" ? (
              <>
                <h2 id="report-title">Thank you!</h2>
                <p>
                  Your report is in as number {stage.report.number}. There's nothing more to do.
                  {stage.report.url && (
                    <>
                      {" "}
                      If you're curious, you can{" "}
                      <a href={stage.report.url} target="_blank" rel="noreferrer">
                        follow it on GitHub
                      </a>
                      .
                    </>
                  )}
                </p>
                <button type="button" className="primary" onClick={close}>
                  Back to the game
                </button>
              </>
            ) : (
              reviewing && draft ? (
                <form
                  className="report-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <h2 id="report-title">Look it over</h2>
                  <TidyNote tidied={draft.tidied !== null} what="report" />
                  <label className="report-words">
                    <span>Title</span>
                    <input type="text" maxLength={TITLE_LIMIT} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                  </label>
                  <label className="report-words">
                    <span>What went wrong</span>
                    <textarea rows={6} maxLength={DESCRIPTION_LIMIT} value={draft.report} onChange={(e) => setDraft({ ...draft, report: e.target.value })} />
                  </label>
                  <div className="tidy-choices">
                    <button
                      type="button"
                      className="link"
                      disabled={draft.report === draft.original && draft.title === titleOf(draft.original)}
                      onClick={() => setDraft({ ...draft, title: titleOf(draft.original), report: draft.original })}
                    >
                      Put my own words back
                    </button>
                    {draft.tidied && (draft.report !== draft.tidied.report || draft.title !== draft.tidied.title) && (
                      <button type="button" className="link" onClick={() => setDraft({ ...draft, ...draft.tidied! })}>
                        Use the tidied version
                      </button>
                    )}
                  </div>
                  <details className="report-details">
                    <summary>See exactly what's sent</summary>
                    <dl>
                      <div>
                        <dt>Title</dt>
                        <dd>{draft.title.trim() || titleOf(draft.report) || "(made from where you were)"}</dd>
                      </div>
                      <div>
                        <dt>Report</dt>
                        <dd className="pre">{draft.report.trim() || "(empty)"}</dd>
                      </div>
                      {draft.report.trim() !== draft.original && (
                        <div>
                          <dt>Your own words</dt>
                          <dd className="pre">{draft.original}</dd>
                        </div>
                      )}
                      <div>
                        <dt>Picture of the screen</dt>
                        <dd>{withShot && shot ? "yes" : "no"}</dd>
                      </div>
                      {withBrowser && browser
                        ? browserLines(browser).map(([label, value]) => (
                            <div key={label}>
                              <dt>{label}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))
                        : (
                            <div>
                              <dt>Browser details</dt>
                              <dd>no</dd>
                            </div>
                          )}
                    </dl>
                  </details>
                  {problem && (
                    <p className="error" role="alert">
                      {problem}
                    </p>
                  )}
                  <div className="report-actions">
                    <button type="button" className="secondary" onClick={() => setStage({ kind: "writing" })} disabled={stage.kind === "sending"}>
                      Back
                    </button>
                    <button type="submit" className="primary" disabled={stage.kind === "sending"}>
                      {stage.kind === "sending" ? "Sending…" : "Send report"}
                    </button>
                  </div>
                </form>
              ) : (
              <form
                className="report-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void next();
                }}
              >
                <h2 id="report-title">Report a problem</h2>
                <label className="report-words">
                  <span>
                    What went wrong? <small>(you can leave this empty)</small>
                  </span>
                  <textarea
                    ref={words}
                    rows={3}
                    maxLength={DESCRIPTION_LIMIT}
                    value={description}
                    placeholder="The cards didn't deal, a button did nothing, something looked off…"
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>

                {shot ? (
                  <div className="report-choice">
                    <ToggleSwitch
                      label="Send a picture of the screen"
                      description="The screen as it was when you tapped the bug. Look it over: names and chat on it are sent too."
                      checked={withShot}
                      onCheckedChange={(e: CustomEvent<boolean>) => setWithShot(e.detail)}
                    />
                    {withShot && <img className="report-shot" src={shot} alt="The picture of the screen that would be sent" />}
                  </div>
                ) : (
                  <p className="fine">A picture of the screen couldn't be taken on this device, so none is sent.</p>
                )}

                <div className="report-choice">
                  <ToggleSwitch
                    label="Send my browser's details"
                    description="Which browser and device this is, and the size of its screen."
                    checked={withBrowser}
                    onCheckedChange={(e: CustomEvent<boolean>) => setWithBrowser(e.detail)}
                  />
                  {withBrowser && browser && (
                    <details className="report-details">
                      <summary>See exactly what's sent</summary>
                      <dl>
                        {browserLines(browser).map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}
                </div>

                <p className="fine">
                  Reports are posted where anyone can read them, so the people who work on Card Room can fix things. Yours also says which game and screen you were on and any
                  errors the page ran into. It never includes your name.
                  {canTidy && " Next, you'll see it tidied up for the developers, and you can change it before it's sent."}
                </p>
                {problem && (
                  <p className="error" role="alert">
                    {problem}
                  </p>
                )}
                <div className="report-actions">
                  <button type="button" className="secondary" onClick={close} disabled={stage.kind === "sending" || stage.kind === "tidying"}>
                    Cancel
                  </button>
                  <button type="submit" className="primary" disabled={stage.kind === "sending" || stage.kind === "tidying"}>
                    {stage.kind === "sending" ? "Sending…" : stage.kind === "tidying" ? "Tidying it up…" : canTidy && description.trim().length >= TIDY_FROM ? "Next" : "Send report"}
                  </button>
                </div>
              </form>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
