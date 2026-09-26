import { expect, test } from "bun:test";
import { nameFromMetadata, parseFigmaUrl } from "./figma-url";

test("node URLs are parsed, everything else is refused", () => {
  expect(parseFigmaUrl("https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34&t=x")).toEqual({
    fileKey: "AbC123xyz",
    nodeId: "12:34",
    url: "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34&t=x",
  });
  expect(parseFigmaUrl("https://figma.com/file/AbC123xyz/?node-id=12%3A34")?.nodeId).toBe("12:34");
  for (const bad of [
    "https://www.figma.com/design/AbC123xyz/Kibo",
    "http://www.figma.com/design/AbC123xyz/Kibo?node-id=1-2",
    "https://evil.com/design/AbC123xyz/Kibo?node-id=1-2",
    "https://www.figma.com.evil.com/design/AbC123xyz/Kibo?node-id=1-2",
    "https://www.figma.com/design/AbC123xyz/Kibo?node-id=abc",
    "javascript:alert(1)",
    "pas une url",
  ]) {
    expect(parseFigmaUrl(bad)).toBeNull();
  }
});

test("the node name comes from the metadata tool", () => {
  expect(nameFromMetadata('<frame id="12:34" name="Kibo › Tickets &amp; Arbre" x="0" />')).toBe(
    "Kibo › Tickets & Arbre",
  );
  expect(nameFromMetadata("no attributes here")).toBeNull();
});
