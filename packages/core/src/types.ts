// What the client, the server and the tidy-up all share.

/** Where in your app a report came from. All of it is optional beyond the screen, and none of it says who. */
export interface RelayContext {
  /** The screen, in a word or two: "home", "checkout"… */
  screen: string;
  /** A narrower label the issue shows next to the screen (a game, a feature, a plan). */
  scope?: string;
  /**
   * Something only your server can look up (a table, an order, a document). It travels with the report
   * so `enrich` can describe it, and is kept beside the issue's number; an issue never shows it.
   */
  ref?: string;
}

export interface SentReport {
  number: number;
  url: string;
}
/** `again` is true when the request was added to one already open. */
export interface SentRequest extends SentReport {
  again: boolean;
}

/** What a user wrote for the developers, and where they were. */
export type TidyInput =
  | { kind: "bug"; description: string; screen?: string; scope?: string }
  | { kind: "request"; name: string; note?: string };
/** The same, tidied: a title and a short report, or a request's proper name and a short note. */
export type Tidied = { kind: "bug"; title: string; report: string } | { kind: "request"; name: string; note: string };

export interface BrowserInfo {
  userAgent: string;
  platform: string;
  viewport: string;
  screen: string;
  language: string;
  installed: boolean;
  touch: boolean;
  online: boolean;
  reducedMotion: boolean;
}

/** How much of each thing is read. The client and the server both stop at these. */
export const LIMITS = {
  description: 2000,
  title: 90,
  name: 60,
  note: 600,
  tidyReport: 1500,
  /** The biggest screenshot taken, in bytes. The client shrinks its picture to fit well under this. */
  shot: 600_000,
  /** The biggest report the server reads at all: a screenshot as base64, and the rest. */
  report: 1_000_000,
} as const;
