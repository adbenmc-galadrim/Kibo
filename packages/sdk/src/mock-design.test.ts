import { expect, test } from "bun:test";
import { KiboError, type StorybookOrigin } from "@kibo/schema";
import { createMockSdk } from "./mock";
import { mockDesignFrame } from "./mock-design";

const FIGMA_URL = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34&t=abc";
const PENPOT_URL =
  "https://design.penpot.app/#/workspace/7d5c3a90-0000-4000-8000-000000000001/7d5c3a90-0000-4000-8000-000000000002/7d5c3a90-0000-4000-8000-000000000003?page-id=7d5c3a90-0000-4000-8000-000000000004&board-id=7d5c3a90-0000-4000-8000-000000000005";

test("a known frame yields a data url, an unknown url NOT_CONNECTED, a bad url INVALID_INPUT", () => {
  const frames = [{ url: FIGMA_URL, name: "Tickets", width: 1440, height: 900 }];
  const bare = FIGMA_URL.replace("&t=abc", "");
  const frame = mockDesignFrame(frames, bare, false, 5);
  expect(frame).toMatchObject({
    id: "figma:AbC123xyz/12:34",
    provider: "figma",
    name: "Tickets",
    width: 1440,
    height: 900,
    mime: "image/png",
    stale: false,
    reachable: true,
    fetchedAt: 5,
    source: bare,
  });
  expect(frame.url.startsWith("data:image/png;base64,")).toBe(true);
  expect(() => mockDesignFrame(frames, PENPOT_URL, false)).toThrow("NOT_CONNECTED");
  expect(() => mockDesignFrame(frames, "https://example.com", false)).toThrow("INVALID_INPUT");
  expect(
    mockDesignFrame([{ url: FIGMA_URL, name: "T", stale: true, reachable: false }], FIGMA_URL, false),
  ).toMatchObject({ stale: true, reachable: false, width: null, height: null });
});

test("a penpot board is served with its own png", () => {
  const frame = mockDesignFrame([{ url: PENPOT_URL, name: "Board", png: "AAAA" }], PENPOT_URL, true, 1);
  expect(frame).toMatchObject({ provider: "penpot", name: "Board", url: "data:image/png;base64,AAAA" });
});

test("a mock frame can fail with a chosen code", () => {
  expect(() =>
    mockDesignFrame([{ url: FIGMA_URL, name: "Tickets", error: "REMOTE_NOT_RENDERED" }], FIGMA_URL, false),
  ).toThrow(KiboError);
  expect(() =>
    mockDesignFrame([{ url: FIGMA_URL, name: "Tickets", error: "TIMEOUT" }], FIGMA_URL, false),
  ).toThrow(expect.objectContaining({ code: "TIMEOUT" }));
  expect(mockDesignFrame([{ url: FIGMA_URL, name: "Tickets" }], FIGMA_URL, false).name).toBe("Tickets");
});

const STORY_URL = "http://localhost:6006/?path=/story/screens-home--default";
const base = {
  id: "probe",
  version: "1.0.0",
  kind: "widget" as const,
  title: "Probe",
  reads: [],
  writes: [],
};

test("an html mock frame is a storybook page, not an image", () => {
  const frame = mockDesignFrame(
    [
      { url: FIGMA_URL, name: "Tickets" },
      { url: STORY_URL, name: "Accueil", html: true },
    ],
    STORY_URL,
    false,
    3,
  );
  expect(frame).toMatchObject({
    id: "storybook:localhost:6006/screens-home--default",
    provider: "storybook",
    name: "Accueil",
    mime: "text/html",
    url: "about:blank#story-1",
    width: null,
    height: null,
    stale: false,
    reachable: true,
    source: "http://localhost:6006/?path=/story/screens-home--default",
  });
});

test("the mock lists the storybook origins it is given", async () => {
  const origins: StorybookOrigin[] = [
    { origin: "http://localhost:6006", label: "Projet", branch: null, path: null, reachable: true },
    { origin: "http://localhost:6007", label: "feat/x", branch: "feat/x", path: "/w/x", reachable: false },
  ];
  const m = createMockSdk({ ...base, capabilities: ["design"] }, { storybooks: origins });
  expect(await m.sdk.design.storybooks()).toEqual(origins);
  expect(m.used).toEqual(["cap:design"]);
  expect(await createMockSdk({ ...base, capabilities: ["design"] }).sdk.design.storybooks()).toEqual([]);
});
