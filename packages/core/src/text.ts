// Putting a stranger's words into a public issue without letting them do anything but be read.

/** One line of someone's text: no control characters, no longer than `max`. */
export const line = (value: unknown, max: number) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, max);

/** Several lines of it. */
export const lines = (value: unknown, max: number) =>
  String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);

/**
 * A stranger's words as plain text in an issue: no formatting, no links by name, no HTML, and above all
 * no @mentions or #references, which would notify people and mark other issues in the token's name.
 */
export const plain = (text: string) => text.replace(/[\\`*_~[\]<>|#]/g, "\\$&").replace(/@/g, "@\u200b");

/** The same words as a quote. */
export const quote = (text: string) =>
  plain(text)
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");

/** A code block nothing inside can close. */
export function fence(text: string): string {
  const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const ticks = "`".repeat(longest + 1);
  return `${ticks}\n${text}\n${ticks}`;
}

export const details = (summary: string, body: string) => `<details>\n<summary>${summary}</summary>\n\n${body}\n\n</details>`;

/** A name as two requests for it would share it: "Mah-Jongg!" and "mah jongg" are one. */
export const sameName = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
