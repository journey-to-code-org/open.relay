import { defaultClasses, type Classes } from "./classes.js";
import { tidyCopy, type TidyCopy } from "./copy.js";

/** The line at the top of the look-it-over step: what happened to their words. */
export function TidyNote({ tidied, what, copy = tidyCopy, classes }: { tidied: boolean; what: "report" | "request"; copy?: TidyCopy; classes?: Partial<Classes> }) {
  const c = { ...defaultClasses, ...classes };
  return <p className={`${c.fine} ${c.tidyNote}`}>{tidied ? copy.tidied(what) : copy.untidied(what)}</p>;
}
