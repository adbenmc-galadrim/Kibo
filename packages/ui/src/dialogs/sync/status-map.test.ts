import { expect, test } from "bun:test";
import { DEFAULT_WORKFLOW } from "@kibo/schema";
import { EMPTY_SYNC_FORM, parseLabels, prefillStatusMap, toBindingConfig } from "./status-map";

const options = [
  { id: "o1", name: "À faire" },
  { id: "o2", name: " en cours " },
  { id: "o3", name: "Done" },
];

test("statuses are prefilled by identical labels only", () => {
  expect(prefillStatusMap(DEFAULT_WORKFLOW, options)).toEqual({ todo: "o1", in_progress: "o2" });
});

test("labels are split, trimmed, deduplicated", () => {
  expect(parseLabels(" bug, ui ,bug,, ")).toEqual(["bug", "ui"]);
});

test("the form becomes a binding config", () => {
  expect(toBindingConfig(EMPTY_SYNC_FORM)).toBeNull();
  expect(toBindingConfig({ ...EMPTY_SYNC_FORM, repo: "adam/kibo", labels: "bug" })).toEqual({
    repo: "adam/kibo",
    project: null,
    importClosed: false,
    labels: ["bug"],
  });
  const project = {
    owner: "adam",
    number: 3,
    nodeId: "PVT_1",
    title: "Roadmap",
    statusField: { id: "F1", options },
  };
  expect(
    toBindingConfig({ ...EMPTY_SYNC_FORM, repo: "adam/kibo", project, statusMap: { todo: "o1" } })?.project,
  ).toEqual({
    owner: "adam",
    number: 3,
    nodeId: "PVT_1",
    statusFieldId: "F1",
    statusMap: { todo: "o1" },
  });
});
