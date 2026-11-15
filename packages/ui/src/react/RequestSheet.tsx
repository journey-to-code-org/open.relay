// "Ask for a game": a line in the front page's footer opens this sheet. A game's name and, if they
// like, a note; the card room files the request on GitHub for them (see the server's bugs.ts). With an
// AI key, "Next" first tidies it (the game's proper name, a short note) for them to look over.
import TextField from "@spades/ui/zubra-ui/text-field.zb";
import { useEffect, useState } from "react";
import { ASK_EVENT, askForGame, bugs, type SentReport } from "./bugReport";
import { TidyNote, useTidy } from "./Tidy";
import { arranged } from "./catalogue";
import { GAME_LIST } from "./GamePicker";

const NOTE_LIMIT = 600;
/** A game's name with only its letters and digits, so "Gin rummy" finds "Gin Rummy". */
const plainName = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export function GameRequest() {
  const [open, setOpen] = useState(false);
  const [game, setGame] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<(SentReport & { again: boolean; game: string }) | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const canTidy = useTidy();
  const [tidying, setTidying] = useState(false);
  /** Looking over a tidied request: what goes, what the AI suggested, and what the player wrote. */
  const [draft, setDraft] = useState<{ game: string; note: string; tidied: { game: string; note: string } | null; original: { game: string; note: string } } | null>(null);

  useEffect(() => {
    const ask = () => {
      setSent(null);
      setProblem(null);
      setDraft(null);
      setOpen(true);
    };
    addEventListener(ASK_EVENT, ask);
    return () => removeEventListener(ASK_EVENT, ask);
  }, []);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [open]);

  if (!open) return null;

  // A game the card room already has needs no request.
  const already = (name: string) => (name.trim() ? arranged(GAME_LIST).find((g) => plainName(g.name) === plainName(name)) : undefined);
  const have = already(draft ? draft.game : game);
  const send = async () => {
    setProblem(null);
    setSending(true);
    try {
      const name = (draft ? draft.game : game).trim();
      setSent({ ...(await (draft ? askForGame(name, draft.note.trim(), draft.original) : askForGame(name, note.trim()))), game: name });
      setGame("");
      setNote("");
      setDraft(null);
    } catch (e) {
      setProblem((e as Error).message);
    }
    setSending(false);
  };
  /** "Next": tidy the request first when the card room can, else send it as it is. */
  const next = async () => {
    if (!canTidy) return send();
    const original = { game: game.trim(), note: note.trim() };
    setProblem(null);
    setTidying(true);
    let tidied: { game: string; note: string } | null = null;
    try {
      const t = await bugs.tidy({ kind: "game", ...original });
      if (t.kind === "game") tidied = { game: t.game, note: t.note };
    } catch {
      // Their own words, then: the review says so.
    }
    setTidying(false);
    setDraft({ ...(tidied ?? original), tidied, original });
  };

  return (
    <div data-no-screenshot>
      <div className="sheet-backdrop report-backdrop" onClick={sending || tidying ? undefined : () => setOpen(false)} />
      <div className="sheet report-sheet" role="dialog" aria-modal="true" aria-labelledby="ask-title">
        {sent ? (
          <>
            <h2 id="ask-title">{sent.again ? "You're not the only one!" : "Asked!"}</h2>
            <p>
              {sent.again ? `Someone has already asked for ${sent.game}, so your voice was added to theirs.` : `Your request for ${sent.game} is in.`} It's number {sent.number}.
              {sent.url && (
                <>
                  {" "}
                  If you're curious, you can{" "}
                  <a href={sent.url} target="_blank" rel="noreferrer">
                    follow it on GitHub
                  </a>
                  .
                </>
              )}
            </p>
            <button type="button" className="primary" onClick={() => setOpen(false)}>
              Back to the games
            </button>
          </>
        ) : draft ? (
          <form
            className="report-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.game.trim() && !have) void send();
            }}
          >
            <h2 id="ask-title">Look it over</h2>
            <TidyNote tidied={draft.tidied !== null} what="request" />
            <TextField label="Which game?" required maxlength={60} value={draft.game} onValueChange={(e: CustomEvent<string>) => setDraft({ ...draft, game: e.detail })} />
            {have && (
              <p>
                Good news: {have.emoji} {have.name} is already here. It's on the front page.
              </p>
            )}
            <label className="report-words">
              <span>Note</span>
              <textarea rows={3} maxLength={NOTE_LIMIT} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </label>
            <div className="tidy-choices">
              <button
                type="button"
                className="link"
                disabled={draft.game === draft.original.game && draft.note === draft.original.note}
                onClick={() => setDraft({ ...draft, ...draft.original })}
              >
                Put my own words back
              </button>
              {draft.tidied && (draft.game !== draft.tidied.game || draft.note !== draft.tidied.note) && (
                <button type="button" className="link" onClick={() => setDraft({ ...draft, ...draft.tidied! })}>
                  Use the tidied version
                </button>
              )}
            </div>
            <details className="report-details">
              <summary>See exactly what's sent</summary>
              <dl>
                <div>
                  <dt>Game</dt>
                  <dd>{draft.game.trim()}</dd>
                </div>
                <div>
                  <dt>Note</dt>
                  <dd className="pre">{draft.note.trim() || "(none)"}</dd>
                </div>
                {(draft.game.trim() !== draft.original.game || draft.note.trim() !== draft.original.note) && (
                  <div>
                    <dt>Your own words</dt>
                    <dd className="pre">{[draft.original.game, draft.original.note].filter(Boolean).join("\n\n")}</dd>
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
              <button
                type="button"
                className="secondary"
                disabled={sending}
                onClick={() => {
                  setGame(draft.original.game);
                  setNote(draft.original.note);
                  setDraft(null);
                }}
              >
                Back
              </button>
              <button type="submit" className="primary" disabled={sending || !draft.game.trim() || !!have}>
                {sending ? "Sending…" : "Send request"}
              </button>
            </div>
          </form>
        ) : (
          <form
            className="report-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (game.trim() && !have) void next();
            }}
          >
            <h2 id="ask-title">Ask for a game</h2>
            <TextField label="Which game?" required maxlength={60} value={game} placeholder="Backgammon, Skat, Mexican Train…" onValueChange={(e: CustomEvent<string>) => setGame(e.detail)} />
            {have && (
              <p>
                Good news: {have.emoji} {have.name} is already here. It's on the front page.
              </p>
            )}
            <label className="report-words">
              <span>
                Anything we should know? <small>(you can leave this empty)</small>
              </span>
              <textarea rows={3} maxLength={NOTE_LIMIT} value={note} placeholder="How your family plays it, how many players, a rule you can't do without…" onChange={(e) => setNote(e.target.value)} />
            </label>
            <p className="fine">Requests are posted where anyone can read them, so the people who work on Card Room can see what to build next. Yours never includes your name.</p>
            {problem && (
              <p className="error" role="alert">
                {problem}
              </p>
            )}
            <div className="report-actions">
              <button type="button" className="secondary" onClick={() => setOpen(false)} disabled={sending || tidying}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={sending || tidying || !game.trim() || !!have}>
                {sending ? "Sending…" : tidying ? "Tidying it up…" : canTidy ? "Next" : "Send request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
