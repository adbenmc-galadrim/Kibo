import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { descriptionEditOf, editDescription } from "./description-edit";

describe("editDescription", () => {
  test("append on an empty description gives the text alone", () => {
    expect(editDescription("", { kind: "append", text: "B" })).toBe("B");
  });

  test("append puts a blank line between the current text and the new one", () => {
    expect(editDescription("A", { kind: "append", text: "B" })).toBe("A\n\nB");
  });

  test("prepend puts the new text first", () => {
    expect(editDescription("A", { kind: "prepend", text: "B" })).toBe("B\n\nA");
    expect(editDescription("", { kind: "prepend", text: "B" })).toBe("B");
  });

  test("trailing newlines do not pile up blank lines", () => {
    expect(editDescription("A\n", { kind: "append", text: "B\n" })).toBe("A\n\nB\n");
    expect(editDescription("A\n", { kind: "prepend", text: "B\n" })).toBe("B\n\nA\n");
  });

  test("replace drops the current text", () => {
    expect(editDescription("A", { kind: "replace", text: "B" })).toBe("B");
  });
});

describe("descriptionEditOf", () => {
  const read = (raw: string) => (raw.startsWith("@") ? `contenu de ${raw.slice(1)}` : raw);

  test("--description @file reads through read", () => {
    expect(descriptionEditOf({ description: "@f.md" }, read)).toEqual({
      kind: "replace",
      text: "contenu de f.md",
    });
  });

  test("--append and --prepend give their kind", () => {
    expect(descriptionEditOf({ append: "B" }, read)).toEqual({ kind: "append", text: "B" });
    expect(descriptionEditOf({ prepend: "B" }, read)).toEqual({ kind: "prepend", text: "B" });
  });

  test("two of them together are refused", () => {
    const both = () => descriptionEditOf({ description: "A", append: "B" }, read);
    expect(both).toThrow(KiboError);
    expect(both).toThrow("--description, --append and --prepend are exclusive");
  });

  test("none of them gives null", () => {
    expect(descriptionEditOf({ title: "T" }, read)).toBeNull();
  });

  test("a bare flag needs a value", () => {
    expect(() => descriptionEditOf({ append: true }, read)).toThrow("--append needs a value");
  });
});
