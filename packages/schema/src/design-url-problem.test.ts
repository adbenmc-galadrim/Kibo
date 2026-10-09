import { expect, test } from "bun:test";
import fc from "fast-check";
import { designUrlProblem, parseDesignUrl } from "./index";

const FILE = "33333333-3333-4333-8333-333333333333";
const PAGE = "44444444-4444-4444-8444-444444444444";
const BOARD = "55555555-5555-4555-8555-555555555555";
const WORKSPACE = `https://design.penpot.app/#/workspace?team-id=11111111-1111-4111-8111-111111111111&file-id=${FILE}&page-id=${PAGE}`;

test("every refused url has one cause, every accepted url has none", () => {
  expect(designUrlProblem(`${WORKSPACE}&board-id=${BOARD}`)).toBeNull();
  expect(designUrlProblem(WORKSPACE)).toBe("penpot-board-missing");
  expect(designUrlProblem(`https://design.penpot.app/#/workspace?team-id=1&file-id=${FILE}`)).toBe(
    "penpot-page-missing",
  );
  expect(designUrlProblem("https://design.penpot.app/#/workspace?team-id=1&file-id=abc")).toBe(
    "penpot-file-missing",
  );
  expect(designUrlProblem("https://design.penpot.app/#/dashboard/recent?team-id=1")).toBe(
    "penpot-file-missing",
  );
  expect(
    designUrlProblem(`http://penpot.lan:9010/#/workspace?file-id=${FILE}&page-id=${PAGE}&board-id=${BOARD}`),
  ).toBe("penpot-insecure");
  expect(designUrlProblem("https://www.figma.com/design/AbC123xyz/Kibo")).toBe("figma-node-missing");
  expect(designUrlProblem("https://www.figma.com/board/AbC123xyz/Kibo?node-id=1-2")).toBe(
    "figma-node-missing",
  );
  expect(designUrlProblem("https://example.com/nope")).toBe("unknown-site");
  expect(designUrlProblem("http://sb.example.com/iframe.html?id=a--b")).toBe("storybook-insecure");
  expect(designUrlProblem("https://sb.example.com/iframe.html?viewMode=story")).toBe(
    "storybook-story-missing",
  );
  expect(designUrlProblem("https://sb.example.com/iframe.html?id=a--b")).toBeNull();
  expect(designUrlProblem("https://user:pw@design.penpot.app/#/workspace")).toBe("credentials");
  expect(designUrlProblem("pas une url")).toBe("not-a-url");
  expect(designUrlProblem("")).toBe("not-a-url");
  fc.assert(
    fc.property(fc.webUrl({ withFragments: true, withQueryParameters: true }), (url) => {
      return (designUrlProblem(url) === null) === (parseDesignUrl(url) !== null);
    }),
  );
});

test("a 2.x view url with ids in the query is a board", () => {
  const view = `https://design.penpot.app/#/view?file-id=${FILE}&page-id=${PAGE}&board-id=${BOARD}&section=interactions`;
  expect(parseDesignUrl(view)?.key).toEqual({
    provider: "penpot",
    instance: "https://design.penpot.app",
    fileId: FILE,
    pageId: PAGE,
    boardId: BOARD,
  });
  expect(
    designUrlProblem(
      `https://design.penpot.app/#/view?file-id=${FILE}&page-id=${PAGE}&section=interactions&index=0`,
    ),
  ).toBe("penpot-board-missing");
});
