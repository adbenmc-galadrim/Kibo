import { expect, test } from "bun:test";
import fc from "fast-check";
import { DesignFrameKey } from "./design";
import { designUrlProblem, parseDesignUrl, storyUrl, storyUrlWithOrigin } from "./design-url";

const STORY = "screens-home--default";
const FIGMA = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34";

test("an iframe.html story url yields a storybook key and a normalized url", () => {
  const url = `https://sb.example.com/iframe.html?id=${STORY}&viewMode=story`;
  expect(parseDesignUrl(url)).toEqual({
    key: { provider: "storybook", origin: "https://sb.example.com", storyId: STORY },
    url,
  });
  expect(parseDesignUrl(`https://sb.example.com/iframe.html?id=${STORY}&viewMode=docs`)?.url).toBe(url);
});

test("the manager url forms yield the same key and the iframe url", () => {
  const normalized = `http://localhost:6006/iframe.html?id=${STORY}&viewMode=story`;
  const key = { provider: "storybook", origin: "http://localhost:6006", storyId: STORY } as const;
  for (const raw of [
    `http://localhost:6006/?path=/story/${STORY}`,
    `http://localhost:6006/index.html?path=/story/${STORY}`,
    `http://localhost:6006/?path=/docs/${STORY}`,
  ]) {
    expect(parseDesignUrl(raw)).toEqual({ key, url: normalized });
  }
});

test("args and globals stay in the url, not in the key", () => {
  const parsed = parseDesignUrl(
    `https://sb.example.com/iframe.html?id=${STORY}&viewMode=story&args=bg:red&globals=theme:dark&foo=1`,
  );
  expect(parsed?.key).toEqual({ provider: "storybook", origin: "https://sb.example.com", storyId: STORY });
  const params = new URL(parsed?.url ?? "").searchParams;
  expect(params.get("args")).toBe("bg:red");
  expect(params.get("globals")).toBe("theme:dark");
  expect(params.get("foo")).toBeNull();
  expect(params.get("viewMode")).toBe("story");
});

test("storybook urls are refused with a cause", () => {
  expect(designUrlProblem("http://sb.example.com/iframe.html?id=x")).toBe("storybook-insecure");
  expect(designUrlProblem("https://sb.example.com/iframe.html")).toBe("storybook-story-missing");
  expect(designUrlProblem("https://sb.example.com/?path=/settings/about")).toBe("storybook-story-missing");
  expect(designUrlProblem("https://sb.example.com/iframe.html?id=Screens--Home")).toBe(
    "storybook-story-missing",
  );
  expect(designUrlProblem("https://example.com/page")).toBe("unknown-site");
  expect(designUrlProblem(`http://localhost:6006/?path=/story/${STORY}`)).toBeNull();
});

test("storyUrl normalizes and storyUrlWithOrigin swaps the origin of a story only", () => {
  expect(storyUrl("http://localhost:6006", STORY)).toBe(
    `http://localhost:6006/iframe.html?id=${STORY}&viewMode=story`,
  );
  const withArgs = storyUrl("http://localhost:6006", STORY, { args: "bg:red", globals: null });
  expect(new URL(withArgs).searchParams.get("args")).toBe("bg:red");
  const moved = storyUrlWithOrigin(withArgs, "http://localhost:6007");
  expect(parseDesignUrl(moved ?? "")?.key).toEqual({
    provider: "storybook",
    origin: "http://localhost:6007",
    storyId: STORY,
  });
  expect(new URL(moved ?? "").searchParams.get("args")).toBe("bg:red");
  expect(storyUrlWithOrigin(FIGMA, "http://localhost:6007")).toBeNull();
  expect(storyUrlWithOrigin(withArgs, "http://192.168.1.10:6007")).toBeNull();
});

test("any accepted story url re-parses to the same key and url (property)", () => {
  const storyId = fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,40}$/);
  const origin = fc.oneof(
    fc
      .domain()
      .filter((d) => d !== "figma.com" && d !== "www.figma.com")
      .map((d) => `https://${d}`),
    fc.integer({ min: 1024, max: 65535 }).map((p) => `http://localhost:${p}`),
  );
  const extra = fc.option(fc.string({ maxLength: 20 }), { nil: null });
  fc.assert(
    fc.property(origin, storyId, extra, extra, (o, id, args, globals) => {
      const parsed = parseDesignUrl(storyUrl(o, id, { args, globals }));
      if (parsed === null) throw new Error(`refused ${o} ${id}`);
      expect(DesignFrameKey.parse(parsed.key)).toEqual(parsed.key);
      expect(parseDesignUrl(parsed.url)).toEqual(parsed);
    }),
  );
});
