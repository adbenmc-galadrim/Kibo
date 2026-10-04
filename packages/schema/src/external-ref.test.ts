import { expect, test } from "bun:test";
import { ExternalRef, ExternalRefKind, externalRefKey, externalRefTarget } from "./external-ref";

const IDS = {
  file: "33333333-3333-4333-8333-333333333333",
  page: "44444444-4444-4444-8444-444444444444",
  board: "55555555-5555-4555-8555-555555555555",
};
const PENPOT_NEW = `https://design.penpot.app/#/view/${IDS.file}?page-id=${IDS.page}&board-id=${IDS.board}`;

test("a penpot board ref is keyed by file, page and board", () => {
  const ref = ExternalRef.parse({
    kind: "penpot_board",
    instance: "https://design.penpot.app",
    fileId: IDS.file,
    pageId: IDS.page,
    boardId: IDS.board,
    url: PENPOT_NEW,
    name: "Accueil",
  });
  expect(externalRefKey(ref)).toBe(`${IDS.file}/${IDS.page}/${IDS.board}`);
  expect(externalRefTarget(ref)).toBe(`penpot_board:${IDS.file}/${IDS.page}/${IDS.board}`);
  expect(ExternalRefKind.options).toContain("penpot_board");
});

test("a penpot board ref refuses an http instance off loopback", () => {
  const ref = {
    kind: "penpot_board",
    instance: "http://192.168.1.2:9010",
    fileId: IDS.file,
    pageId: IDS.page,
    boardId: IDS.board,
    url: PENPOT_NEW,
    name: "Accueil",
  };
  expect(ExternalRef.safeParse(ref).success).toBe(false);
});
