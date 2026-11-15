import { tidyCopy, type TidyCopy } from "./copy.js";

/** The line at the top of the look-it-over step: what happened to their words. */
export function TidyNote({ tidied, what, copy = tidyCopy }: { tidied: boolean; what: "report" | "request"; copy?: TidyCopy }) {
  return <p className="relay-fine relay-tidy-note">{tidied ? copy.tidied(what) : copy.untidied(what)}</p>;
}
