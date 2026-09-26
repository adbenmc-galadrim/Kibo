import { describe, expect, test } from "bun:test";
import type { BindingConfig } from "@kibo/schema";
import { fromItem, fromRest, toFields, toRef } from "./map";

const rest = {
  node_id: "I_1",
  number: 1,
  title: "Titre  ",
  body: "a\r\nb",
  state: "open" as const,
  updated_at: "2026-09-26T10:00:00Z",
  html_url: "https://github.com/adam/kibo/issues/1",
  labels: [{ name: "bug" }, "ui"],
};
const plain: BindingConfig = { repo: "adam/kibo", project: null, importClosed: false, labels: [] };
const withProject: BindingConfig = {
  ...plain,
  project: {
    owner: "adam",
    number: 1,
    nodeId: "PVT",
    statusFieldId: "F",
    statusMap: { todo: "O1", in_progress: "O2", done: "O3" },
  },
};

describe("github issue mapping", () => {
  test("normalizes title, body and labels", () => {
    expect(fromRest("adam/kibo", rest)).toEqual({
      nodeId: "I_1",
      number: 1,
      title: "Titre",
      body: "a\nb",
      closed: false,
      updatedAt: "2026-09-26T10:00:00Z",
      url: "https://github.com/adam/kibo/issues/1",
      repo: "adam/kibo",
      labels: ["bug", "ui"],
      optionId: null,
    });
    expect(fromRest("adam/kibo", { ...rest, body: null }).body).toBe("");
  });

  test("statuses: closed is done, project options map back", () => {
    const issue = fromRest("adam/kibo", rest);
    expect(toFields({ ...issue, closed: true }, plain)).toMatchObject({ statusId: "done", closed: true });
    expect(toFields(issue, plain).statusId).toBe("todo");
    expect(toFields({ ...issue, optionId: "O2" }, withProject).statusId).toBe("in_progress");
    expect(toFields({ ...issue, optionId: "O9" }, withProject).statusId).toBe("todo");
  });

  test("project items: status of the configured field, latest update wins, drafts are skipped", () => {
    const node = {
      id: "PVTI_1",
      updatedAt: "2026-09-26T11:00:00Z",
      fieldValues: {
        nodes: [{}, { optionId: "O9", field: { id: "OTHER" } }, { optionId: "O2", field: { id: "F" } }],
      },
      content: {
        id: "I_1",
        number: 1,
        title: "T",
        body: "",
        state: "OPEN" as const,
        updatedAt: "2026-09-26T10:00:00Z",
        url: "https://github.com/adam/kibo/issues/1",
        repository: { nameWithOwner: "adam/kibo" },
        labels: { nodes: [] },
      },
    };
    expect(fromItem(node, "F")).toMatchObject({
      optionId: "O2",
      updatedAt: "2026-09-26T11:00:00Z",
      closed: false,
    });
    expect(fromItem({ ...node, content: {} }, "F")).toBeNull();
  });

  test("refs point to the binding", () => {
    expect(toRef(fromRest("adam/kibo", rest), "b1")).toEqual({
      kind: "github_issue",
      bindingId: "b1",
      repo: "adam/kibo",
      number: 1,
      nodeId: "I_1",
      url: "https://github.com/adam/kibo/issues/1",
    });
  });
});
