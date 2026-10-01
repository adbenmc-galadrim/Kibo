import { expect, test } from "bun:test";
import { IconInput, IconOwner, iconOwnerKey, iconUrl, MAX_ICON_BASE64 } from "./icon";

test("an icon input is a known mime and standard base64 within the size bound", () => {
  expect(IconInput.safeParse({ mime: "image/png", data: "iVBORw0KGgo=" }).success).toBe(true);
  expect(IconInput.safeParse({ mime: "image/svg+xml", data: "PHN2Zy8+" }).success).toBe(false);
  expect(IconInput.safeParse({ mime: "image/png", data: "not base64!" }).success).toBe(false);
  expect(IconInput.safeParse({ mime: "image/png", data: "" }).success).toBe(false);
  expect(IconInput.safeParse({ mime: "image/png", data: "A".repeat(MAX_ICON_BASE64 + 4) }).success).toBe(
    false,
  );
});

test("owners map to a storage key and a versioned url", () => {
  const project = IconOwner.parse({ kind: "project", projectId: "p1" });
  expect(iconOwnerKey(project)).toBe("project:p1");
  expect(iconOwnerKey({ kind: "workspace" })).toBe("workspace");
  expect(iconUrl(project, "abc")).toBe("/icons/project/p1?v=abc");
  expect(iconUrl({ kind: "workspace" }, "abc")).toBe("/icons/workspace?v=abc");
});
