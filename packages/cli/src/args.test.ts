import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { flagList, flagText, parseArgs, splitList } from "./args";

describe("parseArgs", () => {
  test("--option repeats into a list", () => {
    const { flags } = parseArgs(["questions", "add", "--option", "A", "--option", "B"]);
    expect(flags.option).toEqual(["A", "B"]);
  });

  test("a single --option is still a list by flagList", () => {
    const { flags } = parseArgs(["--option", "A", "--title", "Tournée"]);
    expect(flagList(flags, "option")).toEqual(["A"]);
    expect(flagList(flags, "title")).toEqual(["Tournée"]);
    expect(flagList(flags, "absent")).toEqual([]);
  });

  test("other flags keep the last value", () => {
    const { flags, positional } = parseArgs([
      "tickets",
      "create",
      "Titre",
      "--feature",
      "F5",
      "--feature",
      "F7",
    ]);
    expect(flags.feature).toBe("F7");
    expect(positional).toEqual(["tickets", "create", "Titre"]);
  });

  test("an empty value stays a value", () => {
    expect(parseArgs(["--labels", ""]).flags.labels).toBe("");
  });

  test("flagText reads a value and refuses a bare flag", () => {
    expect(flagText({ title: "Tournée" }, "title")).toBe("Tournée");
    expect(flagText({}, "title")).toBeNull();
    const bare = () => flagText({ title: true }, "title");
    expect(bare).toThrow(KiboError);
    expect(bare).toThrow("--title needs a value");
    expect(() => flagText({ option: ["A", "B"] }, "option")).toThrow("--option needs a value");
  });

  test("flagList refuses a bare flag", () => {
    expect(() => flagList({ option: true }, "option")).toThrow("--option needs a value");
  });

  test("splitList trims and drops empties", () => {
    expect(splitList(" a, b ,,c ")).toEqual(["a", "b", "c"]);
    expect(splitList("")).toEqual([]);
  });
});
