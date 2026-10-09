import { expect, test } from "bun:test";
import { parseFrameUrl } from "./frame-url";

const PENPOT =
  "http://localhost:9010/#/view/33333333-3333-4333-8333-333333333333?page-id=44444444-4444-4444-8444-444444444444&board-id=55555555-5555-4555-8555-555555555555";

test("a story url parses to a storybook key, its origin is checked later by the project rule", () => {
  expect(parseFrameUrl("http://localhost:6007/?path=/story/screens-home--default", null)).toEqual({
    key: { provider: "storybook", origin: "http://localhost:6007", storyId: "screens-home--default" },
    url: "http://localhost:6007/iframe.html?id=screens-home--default&viewMode=story",
  });
  expect(parseFrameUrl("https://sb.example.com/iframe.html?id=a--b", "http://localhost:9010").key).toEqual({
    provider: "storybook",
    origin: "https://sb.example.com",
    storyId: "a--b",
  });
});

test("an insecure story or an unknown site is refused", () => {
  expect(() => parseFrameUrl("http://sb.example.com/iframe.html?id=a--b", null)).toThrow("INVALID_INPUT");
  expect(() => parseFrameUrl("https://example.com/page", null)).toThrow("INVALID_INPUT");
});

test("the penpot instance rule is unchanged", () => {
  expect(parseFrameUrl(PENPOT, "http://localhost:9010").key.provider).toBe("penpot");
  expect(() => parseFrameUrl(PENPOT, "https://design.penpot.app")).toThrow("INVALID_INPUT");
});
