import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { fakeSnapshot } from "../commands/tickets-test-kit";
import { fieldLines, LIST_FIELDS, parseFields, pickFields } from "./list-fields";
import { summarize, type TicketSummary } from "./ticket-view";

const summaries = summarize({
  ...fakeSnapshot(),
  links: [{ id: "l1", from: "a", to: "b", type: "blocks" }],
});
const byKey = (key: string): TicketSummary => {
  const found = summaries.find((t) => t.key === key);
  if (!found) throw new Error(`no ${key}`);
  return found;
};

describe("parseFields", () => {
  test("keeps the requested order", () => {
    expect(parseFields("key,title,sprint")).toEqual(["key", "title", "sprint"]);
    expect(parseFields(" status , key ")).toEqual(["status", "key"]);
  });

  test("refuses an unknown field", () => {
    expect(() => parseFields("key,colour")).toThrow(new KiboError("INVALID_INPUT", "unknown field: colour"));
  });

  test("lists the summary fields plus sprint and feature", () => {
    expect(LIST_FIELDS).toContain("deps");
    expect(LIST_FIELDS).toContain("sprint");
    expect(LIST_FIELDS).toContain("feature");
    expect(LIST_FIELDS).toContain("onHold");
  });
});

describe("pickFields", () => {
  test("gives the sprint code and the feature key", () => {
    expect(pickFields(byKey("SILO-34"), ["key", "sprint", "feature", "optional"])).toEqual({
      key: "SILO-34",
      sprint: "S42",
      feature: "F5",
      optional: true,
    });
    expect(pickFields(byKey("SILO-50"), ["sprint", "feature"])).toEqual({ sprint: null, feature: null });
  });

  test("reduces references to keys and the pull request to its essentials", () => {
    const step = byKey("SILO-34");
    expect(pickFields(step, ["parent", "deps", "children"])).toEqual({
      parent: "SILO-30",
      deps: ["SILO-33"],
      children: [],
    });
    expect(pickFields(byKey("SILO-30"), ["children", "parent"])).toEqual({
      children: ["SILO-33", "SILO-34"],
      parent: null,
    });
    const pr = {
      number: 7,
      url: "https://x/7",
      state: "open" as const,
      review: "none" as const,
      checks: null,
    };
    expect(pickFields({ ...step, pr }, ["pr"])).toEqual({
      pr: { number: 7, url: "https://x/7", state: "open" },
    });
  });
});

describe("fieldLines", () => {
  test("prints a header then tab-separated cells", () => {
    const fields = parseFields("key,sprint,deps,labels,pr");
    const rows = [
      { key: "SILO-34", sprint: "S42", deps: ["SILO-33", "SILO-35"], labels: ["a"], pr: null },
      { key: "SILO-50", sprint: null, deps: [], labels: [], pr: { number: 7, state: "open" } },
    ];
    expect(fieldLines(rows, fields)).toEqual([
      "key\tsprint\tdeps\tlabels\tpr",
      "SILO-34\tS42\tSILO-33,SILO-35\ta\t-",
      'SILO-50\t-\t\t\t{"number":7,"state":"open"}',
    ]);
  });
});
