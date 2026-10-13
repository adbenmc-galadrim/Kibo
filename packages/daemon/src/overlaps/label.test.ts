import { expect, test } from "bun:test";
import { overlapLabel } from "./label";

test("an overlap key reads as its name, its file, or its block size and place", () => {
  expect(overlapLabel({ kind: "export", name: "formatDate", ownerPath: "a.ts", otherPath: "b.ts" })).toBe(
    "`formatDate`",
  );
  expect(overlapLabel({ kind: "file", path: "src/i18n/fr.ts" })).toBe("`src/i18n/fr.ts`");
  expect(
    overlapLabel({
      kind: "block",
      ownerPath: "src/api/client.ts",
      ownerStart: 3,
      otherPath: "src/http.ts",
      otherStart: 9,
      lines: 14,
      chars: 400,
    }),
  ).toBe("bloc de 14 lignes (`src/api/client.ts`)");
});
