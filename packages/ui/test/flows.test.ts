import type { BrowserInfo, Tidied } from "@journey-to-code/relay/client";
import { describe, expect, it, vi } from "vitest";
import { canSubmit, createReportFlow, createRequestFlow, isBusy, isReviewing, isShowing, titleOf, type ReportClient, type RequestClient } from "../src/index.js";

const browser: BrowserInfo = { userAgent: "UA", platform: "P", viewport: "1×1", screen: "2×2", language: "en", installed: false, touch: false, online: true, reducedMotion: false };

function reportClient(over: Partial<ReportClient> = {}) {
  const client = {
    enabled: vi.fn(async () => true),
    canTidy: vi.fn(async () => true),
    browserInfo: vi.fn(() => browser),
    takeScreenshot: vi.fn(async () => "data:image/jpeg;base64,AAAA" as string | null),
    tidy: vi.fn(async (): Promise<Tidied> => ({ kind: "bug", title: "Cards overlap on phones", report: "- Cards overlap." })),
    send: vi.fn(async () => ({ number: 12, url: "https://github.com/o/r/issues/12" })),
    ...over,
  };
  return client as typeof client & ReportClient;
}

describe("the report flow", () => {
  it("is closed, and stays closed, until the server says reporting is on", async () => {
    const client = reportClient({ enabled: vi.fn(async () => false) });
    const flow = createReportFlow(client);
    await flow.open();
    expect(flow.getState()).toMatchObject({ enabled: false, stage: "closed" });
    expect(client.takeScreenshot).not.toHaveBeenCalled();
  });

  it("asks the server once, however many times it is loaded", async () => {
    const client = reportClient();
    const flow = createReportFlow(client);
    await Promise.all([flow.load(), flow.load(), flow.open()]);
    expect(client.enabled).toHaveBeenCalledTimes(1);
  });

  it("takes the picture before the sheet shows, then waits for words", async () => {
    const flow = createReportFlow(reportClient());
    await flow.load();
    const seen: string[] = [];
    flow.subscribe(() => seen.push(flow.getState().stage));
    await flow.open();
    expect(seen).toEqual(["looking", "writing"]);
    expect(flow.getState()).toMatchObject({ shot: "data:image/jpeg;base64,AAAA", browser, stage: "writing" });
    expect(isShowing(flow.getState())).toBe(true);
  });

  it("is not showing while the picture is being taken, and can be closed meanwhile", async () => {
    let finish!: (shot: string | null) => void;
    const flow = createReportFlow(reportClient({ takeScreenshot: () => new Promise((r) => (finish = r)) }));
    const opening = flow.open();
    await vi.waitFor(() => expect(flow.getState().stage).toBe("looking"));
    expect(isShowing(flow.getState())).toBe(false);
    expect(isBusy(flow.getState())).toBe(true);
    flow.close();
    finish("data:image/jpeg;base64,AAAA");
    await opening;
    expect(flow.getState().stage).toBe("closed");
  });

  it("sends short words as they are, with the person's choices about the picture and browser", async () => {
    const client = reportClient();
    const flow = createReportFlow(client);
    await flow.open();
    flow.setDescription("Broken");
    flow.setWithBrowser(false);
    await flow.next();
    expect(client.tidy).not.toHaveBeenCalled();
    expect(client.send).toHaveBeenCalledWith({ description: "Broken", screenshot: "data:image/jpeg;base64,AAAA", browser: null });
    expect(flow.getState()).toMatchObject({ stage: "sent", sent: { number: 12 }, description: "", shot: null });
  });

  it("leaves the picture out when they say no", async () => {
    const client = reportClient();
    const flow = createReportFlow(client);
    await flow.open();
    flow.setWithShot(false);
    await flow.send();
    expect(client.send).toHaveBeenCalledWith({ description: "", screenshot: null, browser });
  });

  it("tidies longer words for them to look over, and sends nothing until they say", async () => {
    const client = reportClient();
    const flow = createReportFlow(client);
    await flow.open();
    flow.setDescription("the cards overlap on my phone");
    expect(flow.willTidy()).toBe(true);
    await flow.next();
    expect(client.send).not.toHaveBeenCalled();
    expect(flow.getState()).toMatchObject({
      stage: "review",
      draft: { title: "Cards overlap on phones", report: "- Cards overlap.", tidied: { title: "Cards overlap on phones", report: "- Cards overlap." }, original: "the cards overlap on my phone" },
    });
    expect(isReviewing(flow.getState())).toBe(true);

    flow.editDraft({ report: "- Cards overlap on a small phone." });
    await flow.send();
    expect(client.send).toHaveBeenCalledWith({ description: "- Cards overlap on a small phone.", title: "Cards overlap on phones", original: "the cards overlap on my phone", screenshot: "data:image/jpeg;base64,AAAA", browser });
    expect(flow.getState().stage).toBe("sent");
  });

  it("can put their own words back, and the tidied version again", async () => {
    const flow = createReportFlow(reportClient());
    await flow.open();
    flow.setDescription("the cards overlap on my phone\nand more");
    await flow.next();
    flow.useOriginal();
    expect(flow.getState().draft).toMatchObject({ title: "the cards overlap on my phone", report: "the cards overlap on my phone\nand more" });
    flow.useTidied();
    expect(flow.getState().draft).toMatchObject({ title: "Cards overlap on phones", report: "- Cards overlap." });
    flow.backToWriting();
    expect(flow.getState().stage).toBe("writing");
  });

  it("sends their own words, noting that tidying didn't work, when it fails", async () => {
    const client = reportClient({ tidy: vi.fn(async () => Promise.reject(new Error("no key"))) as ReportClient["tidy"] });
    const flow = createReportFlow(client);
    await flow.open();
    flow.setDescription("the cards overlap on my phone");
    await flow.next();
    expect(flow.getState().draft).toMatchObject({ tidied: null, report: "the cards overlap on my phone", title: "the cards overlap on my phone" });
  });

  it("goes back to where it came from, with the words kept, when sending fails", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("Give it ten minutes.")).mockResolvedValue({ number: 3, url: "" });
    const flow = createReportFlow(reportClient({ send: send as ReportClient["send"] }));
    await flow.open();
    flow.setDescription("the cards overlap on my phone");
    await flow.next();
    await flow.send();
    expect(flow.getState()).toMatchObject({ stage: "review", problem: "Give it ten minutes.", draft: { report: "- Cards overlap." } });
    await flow.send();
    expect(flow.getState()).toMatchObject({ stage: "sent", problem: null });

    const short = createReportFlow(reportClient({ send: vi.fn(async () => Promise.reject(new Error("down"))) as ReportClient["send"] }));
    await short.open();
    short.setDescription("Broken");
    await short.next();
    expect(short.getState()).toMatchObject({ stage: "writing", problem: "down", description: "Broken" });
  });

  it("keeps the words when they cancel, and drops the picture", async () => {
    const flow = createReportFlow(reportClient());
    await flow.open();
    flow.setDescription("not yet");
    flow.close();
    expect(flow.getState()).toMatchObject({ stage: "closed", description: "not yet", shot: null });
  });

  it("makes a title from the first line", () => {
    expect(titleOf("  First line\nsecond")).toBe("First line");
    expect(titleOf("x".repeat(100))).toBe(`${"x".repeat(79)}…`);
  });

  it("stops telling a watcher once it unsubscribes", async () => {
    const flow = createReportFlow(reportClient());
    const heard = vi.fn();
    const stop = flow.subscribe(heard);
    flow.setDescription("a");
    stop();
    flow.setDescription("b");
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

function requestClient(over: Partial<RequestClient> = {}) {
  const client = {
    enabled: vi.fn(async () => true),
    canTidy: vi.fn(async () => true),
    tidy: vi.fn(async (): Promise<Tidied> => ({ kind: "request", name: "Mahjong", note: "Hong Kong style." })),
    request: vi.fn(async () => ({ number: 7, url: "https://github.com/o/r/issues/7", again: false })),
    ...over,
  };
  return client as typeof client & RequestClient;
}

describe("the request flow", () => {
  const have = new Map([["gin", { emoji: "🃏", name: "Gin Rummy" }]]);
  const findExisting = (name: string) => have.get(name.trim().toLowerCase());

  it("opens with nothing left over from the last one", async () => {
    const flow = createRequestFlow(requestClient());
    await flow.load();
    flow.open();
    flow.setName("Chess");
    await flow.send();
    expect(flow.getState().sent).toMatchObject({ name: "Chess" });
    flow.open();
    expect(flow.getState()).toMatchObject({ open: true, sent: null, problem: null, draft: null });
  });

  it("won't send what is already there", async () => {
    const flow = createRequestFlow(requestClient(), { findExisting });
    await flow.load();
    flow.open();
    flow.setName("Gin");
    expect(flow.getState().existing).toEqual({ emoji: "🃏", name: "Gin Rummy" });
    expect(canSubmit(flow.getState())).toBe(false);
    flow.setName("Chess");
    expect(flow.getState().existing).toBeUndefined();
    expect(canSubmit(flow.getState())).toBe(true);
    flow.setName("  ");
    expect(canSubmit(flow.getState())).toBe(false);
  });

  it("tidies it for them to look over, checks the tidied name too, and sends their choice", async () => {
    const client = requestClient({ tidy: vi.fn(async (): Promise<Tidied> => ({ kind: "request", name: "Gin", note: "Two players." })) as RequestClient["tidy"] });
    const flow = createRequestFlow(client, { findExisting });
    await flow.load();
    flow.open();
    flow.setName("jin rummy");
    flow.setNote("two of us");
    await flow.next();
    expect(client.tidy).toHaveBeenCalledWith({ kind: "request", name: "jin rummy", note: "two of us" });
    expect(flow.getState()).toMatchObject({ draft: { name: "Gin", note: "Two players.", original: { name: "jin rummy", note: "two of us" } }, existing: { name: "Gin Rummy" } });
    expect(canSubmit(flow.getState())).toBe(false);

    flow.useOriginal();
    expect(flow.getState()).toMatchObject({ draft: { name: "jin rummy" }, existing: undefined });
    expect(canSubmit(flow.getState())).toBe(true);
    flow.editDraft({ name: "Jin Rummy", note: "Please." });
    await flow.send();
    expect(client.request).toHaveBeenCalledWith("Jin Rummy", "Please.", { name: "jin rummy", note: "two of us" });
    expect(flow.getState()).toMatchObject({ sent: { number: 7, name: "Jin Rummy", again: false }, draft: null, name: "", sending: false });
  });

  it("sends without tidying when the server can't", async () => {
    const client = requestClient({ canTidy: vi.fn(async () => false) });
    const flow = createRequestFlow(client);
    await flow.load();
    flow.open();
    flow.setName(" Mahjong ");
    flow.setNote(" Hong Kong ");
    await flow.next();
    expect(client.tidy).not.toHaveBeenCalled();
    expect(client.request).toHaveBeenCalledWith("Mahjong", "Hong Kong");
  });

  it("goes back to the words they wrote", async () => {
    const flow = createRequestFlow(requestClient());
    await flow.load();
    flow.open();
    flow.setName("mah jong");
    await flow.next();
    flow.backToWriting();
    expect(flow.getState()).toMatchObject({ name: "mah jong", draft: null });
  });

  it("keeps the words and says why when sending fails", async () => {
    const client = requestClient({ request: vi.fn(async () => Promise.reject(new Error("Try again tomorrow."))) as RequestClient["request"], canTidy: vi.fn(async () => false) });
    const flow = createRequestFlow(client);
    await flow.load();
    flow.open();
    flow.setName("Chess");
    await flow.next();
    expect(flow.getState()).toMatchObject({ problem: "Try again tomorrow.", name: "Chess", sending: false, sent: null });
  });

  it("falls back to their own words when tidying fails", async () => {
    const flow = createRequestFlow(requestClient({ tidy: vi.fn(async () => Promise.reject(new Error("no key"))) as RequestClient["tidy"] }));
    await flow.load();
    flow.open();
    flow.setName("mah jong");
    await flow.next();
    expect(flow.getState()).toMatchObject({ tidying: false, draft: { name: "mah jong", tidied: null } });
  });
});
