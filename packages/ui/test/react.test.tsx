import type { BrowserInfo } from "@journey-to-code/relay/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createReportFlow, createRequestFlow } from "../src/index.js";
import { ReportButton, ReportSheet, RequestButton, RequestSheet, type ToggleProps } from "../src/react/index.js";

const browser: BrowserInfo = { userAgent: "TestAgent/1", platform: "P", viewport: "1×1", screen: "2×2", language: "en", installed: false, touch: false, online: true, reducedMotion: false };
const reportClient = () => ({
  enabled: async () => true,
  canTidy: async () => true,
  browserInfo: () => browser,
  takeScreenshot: async () => "data:image/jpeg;base64,AAAA",
  tidy: async () => ({ kind: "bug" as const, title: "Cards overlap", report: "- Cards overlap." }),
  send: vi.fn(async () => ({ number: 12, url: "https://github.com/o/r/issues/12" })),
});

describe("the report sheet", () => {
  it("shows nothing until reporting is on and the sheet is open", async () => {
    const flow = createReportFlow(reportClient());
    expect(renderToString(<ReportSheet flow={flow} />)).toBe("");
    expect(renderToString(<ReportButton flow={flow} />)).toBe("");
    await flow.load();
    expect(renderToString(<ReportButton flow={flow} />)).toContain('aria-label="Report a problem"');
    expect(renderToString(<ReportSheet flow={flow} />)).toBe("");
  });

  it("writes, reviews and thanks, one stage at a time", async () => {
    const client = reportClient();
    const flow = createReportFlow(client);
    await flow.open();
    const writing = renderToString(<ReportSheet flow={flow} />);
    expect(writing).toContain('role="dialog"');
    expect(writing).toContain("Send a picture of the screen");
    expect(writing).toContain("TestAgent/1");
    expect(writing).toContain("Send report");
    // The button isn't in its own picture, and the sheet isn't either.
    expect(writing).toContain("data-no-screenshot");
    // With a tidying server, long enough words lead to "Next".
    flow.setDescription("the cards overlap on my phone");
    expect(renderToString(<ReportSheet flow={flow} />)).toContain(">Next<");

    await flow.next();
    const review = renderToString(<ReportSheet flow={flow} />);
    expect(review).toContain("Look it over");
    expect(review).toContain("Cards overlap");
    expect(review).toContain("Put my own words back");
    expect(review).toContain("tidied up");

    await flow.send();
    expect(renderToString(<ReportSheet flow={flow} />)).toContain("Your report is in as number 12.");
    expect(renderToString(<ReportSheet flow={flow} />)).toContain("https://github.com/o/r/issues/12");
  });

  it("shows why it failed, and uses the slots and copy it is given", async () => {
    const client = reportClient();
    client.send.mockRejectedValueOnce(new Error("Give it ten minutes."));
    const flow = createReportFlow(client);
    await flow.open();
    await flow.send();
    const Toggle = ({ label, checked }: ToggleProps) => <b className="mine">{`${label}:${checked}`}</b>;
    const html = renderToString(<ReportSheet flow={flow} slots={{ Toggle }} copy={{ title: "Something broke?", send: "Tell us" }} />);
    expect(html).toContain("Give it ten minutes.");
    expect(html).toContain("Something broke?");
    expect(html).toContain("Tell us");
    expect(html).toContain('<b class="mine">Send a picture of the screen:true</b>');
    expect(html).toContain('<b class="mine">Send my browser&#x27;s details:true</b>');
  });
});

describe("the request sheet", () => {
  const requestClient = () => ({
    enabled: async () => true,
    canTidy: async () => false,
    tidy: async () => ({ kind: "request" as const, name: "x", note: "" }),
    request: vi.fn(async () => ({ number: 7, url: "", again: true })),
  });

  it("asks, says when it is already here, and thanks", async () => {
    const flow = createRequestFlow(requestClient(), { findExisting: (name) => (name.toLowerCase() === "gin" ? "Gin Rummy" : undefined) });
    await flow.load();
    expect(renderToString(<RequestSheet flow={flow} />)).toBe("");
    expect(renderToString(<RequestButton flow={flow} label="Ask for a game" />)).toContain("Ask for a game");
    flow.open();
    flow.setName("Gin");
    const html = renderToString(<RequestSheet flow={flow} renderExisting={(game) => `Good news: ${game} is already here.`} />);
    expect(html).toContain("Make a request");
    expect(html).toContain("Good news: Gin Rummy is already here.");
    expect(html).toMatch(/<button type="submit"[^>]*disabled/);

    flow.setName("Mah-Jongg");
    await flow.next();
    const thanks = renderToString(<RequestSheet flow={flow} copy={{ againTitle: "Not the only one!" }} />);
    expect(thanks).toContain("Not the only one!");
    expect(thanks).toContain("Someone has already asked for Mah-Jongg");
  });
});
