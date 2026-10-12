import { afterEach, expect, test } from "bun:test";
import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DUPLICATION_LIMITS, MASKED, type OverlapDetail } from "@kibo/schema";
import { cleanupTmp, tmp } from "../agents/git-test-kit";
import { localPeekFs, screenOf } from "./peek-fakes.test-helper";
import { createOverlapReader } from "./read";
import { openOverlapStore } from "./store";

afterEach(cleanupTmp);

const space = (files: Record<string, string>): string => {
  const key = realpathSync(tmp());
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(key, path)), { recursive: true });
    writeFileSync(join(key, path), content);
  }
  return key;
};

function scene(detail: OverlapDetail, owner: string, other: string) {
  const store = openOverlapStore(tmp());
  const overlap = store.create(
    {
      kind: detail.kind,
      key: `${detail.kind}:k`,
      ownerWorkspace: owner,
      otherWorkspace: other,
      ownerRunId: "ra",
      otherRunId: "rb",
      detail,
    },
    "P",
    1,
  );
  const read = createOverlapReader({
    store,
    runName: (runId) => (runId === "ra" ? "bou · livraison · BOU-12" : "bou · livraison · BOU-15"),
    screen: screenOf({ ".env": "secret" }),
    fs: localPeekFs,
  });
  return { id: overlap.id, read };
}

const EXPORT: OverlapDetail = {
  kind: "export",
  name: "formatDate",
  ownerPath: "src/lib/format.ts",
  otherPath: "src/utils/date.ts",
};

test("an export overlap reads each side at its own path, masked", async () => {
  const owner = space({ "src/lib/format.ts": "export const formatDate = 1;\n// sk-abcdefghijklmnop1234\n" });
  const other = space({ "src/utils/date.ts": "export function formatDate() {}\n" });
  const { id, read } = scene(EXPORT, owner, other);
  expect(await read(id)).toEqual({
    owner: {
      runId: "ra",
      runName: "bou · livraison · BOU-12",
      path: "src/lib/format.ts",
      content: `export const formatDate = 1;\n// ${MASKED}\n`,
      reason: null,
    },
    other: {
      runId: "rb",
      runName: "bou · livraison · BOU-15",
      path: "src/utils/date.ts",
      content: "export function formatDate() {}\n",
      reason: null,
    },
  });
});

test("a deleted file, a vanished workspace, a secret or a huge file give a reason instead of content", async () => {
  const owner = space({});
  const gone = space({});
  rmSync(gone, { recursive: true });
  const { id, read } = scene(EXPORT, owner, gone);
  const sides = await read(id);
  expect(sides.owner).toMatchObject({ content: null, reason: "fichier absent" });
  expect(sides.other).toMatchObject({ content: null, reason: "espace de travail disparu" });

  const big = "x".repeat(DUPLICATION_LIMITS.peekContentBytes + 1);
  const huge = scene(
    { ...EXPORT, ownerPath: "big.ts", otherPath: ".env" },
    space({ "big.ts": big }),
    space({ ".env": "A=1" }),
  );
  const refused = await huge.read(huge.id);
  expect(refused.owner).toMatchObject({ content: null, reason: "fichier trop grand" });
  expect(refused.other).toMatchObject({ content: null, reason: "fichier secret" });
});

test("a file overlap reads the same path on both sides; an unknown overlap is NOT_FOUND", async () => {
  const detail: OverlapDetail = { kind: "file", path: "src/i18n/fr.ts" };
  const { id, read } = scene(detail, space({ "src/i18n/fr.ts": "a" }), space({ "src/i18n/fr.ts": "b" }));
  const sides = await read(id);
  expect([sides.owner.path, sides.owner.content, sides.other.path, sides.other.content]).toEqual([
    "src/i18n/fr.ts",
    "a",
    "src/i18n/fr.ts",
    "b",
  ]);
  await expect(read("nope")).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
});
