import { expect, test } from "bun:test";
import fc from "fast-check";
import {
  DesignFrameKey,
  type DesignFrameKey as DesignFrameKeyType,
  designFrameId,
  frameExtension,
  frameKeyOfRef,
  PenpotBoardRef,
  parseDesignUrl,
} from "./design";

const FIGMA = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34&t=abc";
const IDS = {
  team: "11111111-1111-4111-8111-111111111111",
  project: "22222222-2222-4222-8222-222222222222",
  file: "33333333-3333-4333-8333-333333333333",
  page: "44444444-4444-4444-8444-444444444444",
  board: "55555555-5555-4555-8555-555555555555",
};
const PENPOT_NEW = `https://design.penpot.app/#/workspace/${IDS.team}/${IDS.project}/${IDS.file}?page-id=${IDS.page}&board-id=${IDS.board}`;
const PENPOT_OLD = `https://design.penpot.app/#/workspace?team-id=${IDS.team}&file-id=${IDS.file}&page-id=${IDS.page}&board-id=${IDS.board}`;
const PENPOT_VIEW = `https://design.penpot.app/#/view/${IDS.file}?page-id=${IDS.page}&board-id=${IDS.board}&section=interactions`;
const PENPOT_LOCAL = `http://localhost:9010/#/workspace/${IDS.team}/${IDS.project}/${IDS.file}?page-id=${IDS.page}&board-id=${IDS.board}`;

test("a figma node url yields a figma key with a colon node id", () => {
  expect(parseDesignUrl(FIGMA)).toEqual({
    key: { provider: "figma", fileKey: "AbC123xyz", nodeId: "12:34" },
    url: FIGMA,
  });
  expect(parseDesignUrl("https://www.figma.com/design/AbC123xyz/Kibo")).toBeNull();
  expect(parseDesignUrl("https://figma.com.evil.test/design/AbC123xyz/K?node-id=1-2")).toBeNull();
});

test("the three penpot url forms yield the same key", () => {
  const key: DesignFrameKeyType = {
    provider: "penpot",
    instance: "https://design.penpot.app",
    fileId: IDS.file,
    pageId: IDS.page,
    boardId: IDS.board,
  };
  for (const url of [PENPOT_NEW, PENPOT_OLD, PENPOT_VIEW]) expect(parseDesignUrl(url)?.key).toEqual(key);
});

test("a penpot instance is https, or http on loopback only", () => {
  expect(parseDesignUrl(PENPOT_LOCAL)?.key).toMatchObject({
    provider: "penpot",
    instance: "http://localhost:9010",
  });
  expect(parseDesignUrl(PENPOT_LOCAL.replace("localhost:9010", "192.168.1.10:9010"))).toBeNull();
  expect(parseDesignUrl(PENPOT_NEW.replace("https://", "http://"))).toBeNull();
});

test("hostile or incomplete urls are refused without throwing", () => {
  for (const raw of [
    "javascript:alert(1)",
    "data:text/html,x",
    "",
    "not a url",
    `https://design.penpot.app/#/workspace/${IDS.team}/${IDS.project}/${IDS.file}?page-id=${IDS.page}`,
    PENPOT_NEW.replace(IDS.board, "not-a-uuid"),
    `https://design.penpot.app/#/settings?file-id=${IDS.file}&page-id=${IDS.page}&board-id=${IDS.board}`,
    "https://user:pw@www.figma.com/design/AbC123xyz/K?node-id=1-2",
    "https://127.0.0.1/design/AbC123xyz/K?node-id=1-2",
    `https://www.figma.com/design/AbC123xyz/K?node-id=1-2&x=${"a".repeat(2048)}`,
  ]) {
    expect(parseDesignUrl(raw)).toBeNull();
  }
});

test("designFrameId is stable and distinguishes providers", () => {
  expect(designFrameId({ provider: "figma", fileKey: "AbC123xyz", nodeId: "12:34" })).toBe(
    "figma:AbC123xyz/12:34",
  );
  expect(
    designFrameId({
      provider: "penpot",
      instance: "https://design.penpot.app",
      fileId: IDS.file,
      pageId: IDS.page,
      boardId: IDS.board,
    }),
  ).toBe(`penpot:design.penpot.app/${IDS.file}/${IDS.page}/${IDS.board}`);
});

test("any accepted url re-parses to the same key (property)", () => {
  const hex = fc.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  fc.assert(
    fc.property(hex, hex, hex, (file, page, board) => {
      const url = `https://design.penpot.app/#/view/${file}?page-id=${page}&board-id=${board}`;
      const parsed = parseDesignUrl(url);
      if (parsed === null) throw new Error(`refused ${url}`);
      expect(DesignFrameKey.parse(parsed.key)).toEqual(parsed.key);
      expect(parseDesignUrl(parsed.url)?.key).toEqual(parsed.key);
    }),
  );
});

test("no host other than figma.com or the penpot instance is accepted (property)", () => {
  fc.assert(
    fc.property(fc.domain(), (host) => {
      fc.pre(host !== "figma.com" && host !== "www.figma.com");
      expect(parseDesignUrl(`https://${host}/design/AbC123xyz/K?node-id=1-2`)).toBeNull();
    }),
  );
});

test("frame extensions follow the mime", () => {
  expect(frameExtension("image/png")).toBe("png");
  expect(frameExtension("image/webp")).toBe("webp");
  expect(frameExtension("image/jpeg")).toBe("jpg");
});

test("frameKeyOfRef reads figma and penpot refs only", () => {
  const penpot = PenpotBoardRef.parse({
    kind: "penpot_board",
    instance: "https://design.penpot.app",
    fileId: IDS.file,
    pageId: IDS.page,
    boardId: IDS.board,
    url: PENPOT_NEW,
    name: "Accueil",
  });
  expect(frameKeyOfRef(penpot)).toEqual({
    provider: "penpot",
    instance: "https://design.penpot.app",
    fileId: IDS.file,
    pageId: IDS.page,
    boardId: IDS.board,
  });
  expect(
    frameKeyOfRef({ kind: "figma_node", fileKey: "AbC123xyz", nodeId: "12:34", url: FIGMA, name: "Tickets" }),
  ).toEqual({ provider: "figma", fileKey: "AbC123xyz", nodeId: "12:34" });
  expect(
    frameKeyOfRef({ kind: "github_pr", url: "https://github.com/a/b/pull/1", number: 1, state: "open" }),
  ).toBeNull();
});
