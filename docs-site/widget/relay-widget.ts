// The "Report a problem" button on this documentation site. It is open.relay used as it is meant to
// be: the client gathers the page and the last errors, the flow holds the state, and this file only
// draws it. What a reader sends becomes a GitHub issue labelled `demo`, through a Cloudflare Worker
// (packages/docs-worker). No framework, and nothing here is specific to this site but the words.
import { createRelayClient } from "@journey-to-code/relay/client";
import { createReportFlow, isBusy, isReviewing, isShowing, type ReportState } from "@journey-to-code/relay-ui";

const tag = document.querySelector<HTMLScriptElement>("script[data-relay]");
const base = tag?.dataset.relay;
if (base) start(base);

function start(base: string) {
  const client = createRelayClient({ base, credentials: "omit", built: tag?.dataset.built });
  const flow = createReportFlow(client);
  client.watchForErrors();
  const here = () => client.setContext({ screen: location.pathname });
  here();
  addEventListener("pageshow", here);

  const style = document.createElement("style");
  style.textContent = `
    .relay-demo-button { position: fixed; right: 1rem; bottom: 1rem; z-index: 50; padding: .6rem .9rem; border: 1px solid #0f766e; border-radius: 999px; background: #0f766e; color: #fff; font: 600 .9rem/1 system-ui, sans-serif; cursor: pointer; box-shadow: 0 2px 8px #0003; }
    .relay-demo-button:hover { background: #115e59; }
    .relay-demo-button:focus-visible, .relay-demo-sheet :focus-visible { outline: 3px solid #f59e0b; outline-offset: 2px; }
    .relay-demo-sheet { width: min(32rem, calc(100vw - 2rem)); padding: 1.25rem; border: 1px solid GrayText; border-radius: .75rem; background: Canvas; color: CanvasText; font: 1rem/1.45 system-ui, sans-serif; }
    .relay-demo-sheet::backdrop { background: #0008; }
    .relay-demo-sheet h2 { margin: 0 0 .5rem; font-size: 1.15rem; }
    .relay-demo-sheet p { margin: 0 0 .75rem; }
    .relay-demo-sheet .relay-demo-note { padding: .5rem .65rem; border-left: 4px solid #f59e0b; background: color-mix(in srgb, #f59e0b 14%, Canvas); font-size: .9rem; }
    .relay-demo-sheet label { display: block; margin: .5rem 0 .25rem; font-weight: 600; }
    .relay-demo-sheet textarea, .relay-demo-sheet input[type=text] { box-sizing: border-box; width: 100%; padding: .5rem; border: 1px solid GrayText; border-radius: .4rem; background: Field; color: FieldText; font: inherit; }
    .relay-demo-sheet textarea { min-height: 7rem; resize: vertical; }
    .relay-demo-sheet .relay-demo-check { display: flex; gap: .5rem; align-items: flex-start; margin: .5rem 0; font-weight: 400; }
    .relay-demo-sheet .relay-demo-error { color: #b91c1c; font-weight: 600; }
    .relay-demo-sheet .relay-demo-actions { display: flex; gap: .5rem; justify-content: flex-end; margin-top: 1rem; }
    .relay-demo-sheet button { padding: .5rem .9rem; border: 1px solid #0f766e; border-radius: .4rem; background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .relay-demo-sheet button.primary { background: #0f766e; color: #fff; }
    .relay-demo-sheet button:disabled { opacity: .6; cursor: wait; }
    @media (prefers-reduced-motion: no-preference) { .relay-demo-button { transition: background .15s; } }
  `;
  document.head.append(style);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "relay-demo-button";
  button.textContent = "Report a problem";
  button.hidden = true;
  button.setAttribute("data-no-screenshot", "");
  button.addEventListener("click", () => void flow.open());

  const sheet = document.createElement("dialog");
  sheet.className = "relay-demo-sheet";
  sheet.setAttribute("aria-labelledby", "relay-demo-title");
  sheet.setAttribute("data-no-screenshot", "");
  sheet.addEventListener("cancel", (e) => {
    e.preventDefault();
    if (!isBusy(flow.getState())) flow.close();
  });
  document.body.append(button, sheet);

  const el = <K extends keyof HTMLElementTagNameMap>(name: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...kids: (Node | string)[]) => {
    const { class: className, ...rest } = props as { class?: string };
    const node = Object.assign(document.createElement(name), rest);
    if (className) node.className = className;
    node.append(...kids);
    return node;
  };

  function draw(s: ReportState) {
    button.hidden = !s.enabled;
    if (!isShowing(s)) {
      if (sheet.open) sheet.close();
      return;
    }
    const busy = isBusy(s);
    const keep = document.activeElement instanceof HTMLTextAreaElement ? document.activeElement.selectionStart : null;
    sheet.replaceChildren();
    sheet.append(el("h2", { id: "relay-demo-title" }, s.stage === "sent" ? "Sent, thank you" : "Report a problem"));

    if (s.stage === "sent" && s.sent) {
      sheet.append(
        el("p", {}, "It is issue ", el("a", { href: s.sent.url, target: "_blank", rel: "noopener" }, `#${s.sent.number}`), " on GitHub."),
        el("p", { class: "relay-demo-note" }, "This site is a demo of open.relay, so the issue is labelled ", el("code", {}, "demo"), " and is not a real report. Thank you for trying it."),
        el("div", { class: "relay-demo-actions" }, el("button", { type: "button", class: "primary", onclick: () => flow.close() }, "Close")),
      );
    } else {
      sheet.append(
        el("p", { class: "relay-demo-note" }, "This is a live demo of open.relay. What you send becomes a real GitHub issue on journey-to-code-org/open.relay, labelled ", el("code", {}, "demo"), "."),
      );
      if (isReviewing(s) && s.draft) {
        const title = el("input", { type: "text", id: "relay-demo-draft-title", value: s.draft.title, oninput: () => flow.editDraft({ title: title.value }) });
        const report = el("textarea", { id: "relay-demo-draft", value: s.draft.report, oninput: () => flow.editDraft({ report: report.value }) });
        sheet.append(el("label", { htmlFor: "relay-demo-draft-title" }, "Title"), title, el("label", { htmlFor: "relay-demo-draft" }, "Report"), report);
      } else {
        const words = el("textarea", { id: "relay-demo-words", placeholder: "What went wrong, or what is confusing on this page?", value: s.description, oninput: () => flow.setDescription(words.value) });
        sheet.append(el("label", { htmlFor: "relay-demo-words" }, "What happened?"), words);
        if (!busy) queueMicrotask(() => { words.focus(); if (keep !== null) words.setSelectionRange(keep, keep); });
      }
      const browser = el("input", { type: "checkbox", checked: s.withBrowser, onchange: () => flow.setWithBrowser(browser.checked) });
      sheet.append(el("label", { class: "relay-demo-check" }, browser, "Include my browser and screen size, to help reproduce it"));
      if (s.problem) sheet.append(el("p", { class: "relay-demo-error", role: "alert" }, s.problem));
      const label = s.stage === "tidying" ? "Tidying…" : s.stage === "sending" ? "Sending…" : isReviewing(s) ? "Send" : flow.willTidy() ? "Next" : "Send";
      sheet.append(
        el(
          "div",
          { class: "relay-demo-actions" },
          isReviewing(s) ? el("button", { type: "button", disabled: busy, onclick: () => flow.backToWriting() }, "Back") : "",
          el("button", { type: "button", disabled: busy, onclick: () => flow.close() }, "Cancel"),
          el("button", { type: "button", class: "primary", disabled: busy, onclick: () => void (isReviewing(s) ? flow.send() : flow.next()) }, label),
        ),
      );
    }
    if (!sheet.open) sheet.showModal();
  }

  flow.subscribe(() => draw(flow.getState()));
  void flow.load().then(() => draw(flow.getState()));
}
