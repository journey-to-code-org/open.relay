// The class on each part of the sheets. By default every part has a `relay-*` class (see styles.css).
// If your app already has styles for sheets, buttons and fields, point the parts at your own classes
// instead: `classes={{ sheet: "sheet", primary: "btn btn-primary" }}` replaces just those.

export interface Classes {
  backdrop: string;
  sheet: string;
  form: string;
  /** A label wrapping a text input or a textarea. */
  field: string;
  /** A toggle and what follows it. */
  choice: string;
  /** The row of "put my words back" links. */
  choices: string;
  shot: string;
  details: string;
  /** A value that keeps its line breaks. */
  pre: string;
  error: string;
  fine: string;
  tidyNote: string;
  actions: string;
  primary: string;
  secondary: string;
  link: string;
  /** The button that opens the report sheet. */
  toggleButton: string;
}

export const defaultClasses: Classes = {
  backdrop: "relay-backdrop",
  sheet: "relay-sheet",
  form: "relay-form",
  field: "relay-field",
  choice: "relay-choice",
  choices: "relay-choices",
  shot: "relay-shot",
  details: "relay-details",
  pre: "relay-pre",
  error: "relay-error",
  fine: "relay-fine",
  tidyNote: "relay-tidy-note",
  actions: "relay-actions",
  primary: "relay-primary",
  secondary: "relay-secondary",
  link: "relay-link",
  toggleButton: "relay-toggle-button",
};
