import { expect, test } from "bun:test";
import { INBOX_ID, type ProjectSnapshot, type TabTarget } from "@kibo/schema";
import { fireEvent, render, screen } from "@testing-library/react";
import { kiboProject } from "../agents/fixtures";
import { Breadcrumb, crumbsFor } from "./Breadcrumb";

const kibo: ProjectSnapshot = {
  ...kiboProject(),
  pages: [{ id: "1@1", title: "Board", kind: "view", parentId: null }],
};
const ctx = { project: kibo, branch: null };

test("intermediate crumbs open their target; the last one is plain text", () => {
  const opened: TabTarget[] = [];
  render(
    <Breadcrumb
      crumbs={[
        { label: "Kibo", target: { kind: "project", projectId: "p1" } },
        { label: "KIB-12", target: null },
      ]}
      onOpen={(t) => opened.push(t)}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Kibo" }));
  expect(opened).toEqual([{ kind: "project", projectId: "p1" }]);
  expect(screen.queryByRole("button", { name: "KIB-12" })).toBeNull();
  expect(screen.getByText("KIB-12").getAttribute("aria-current")).toBe("page");
});

test("a double click on a crumb opens its target kept", () => {
  const opened: [TabTarget, boolean | undefined][] = [];
  render(
    <Breadcrumb
      crumbs={[
        { label: "Kibo", target: { kind: "project", projectId: "p1" } },
        { label: "KIB-12", target: null },
      ]}
      onOpen={(t, keep) => opened.push([t, keep])}
    />,
  );
  fireEvent.doubleClick(screen.getByRole("button", { name: "Kibo" }));
  expect(opened).toEqual([[{ kind: "project", projectId: "p1" }, true]]);
});

test("the last crumb stays text even when it carries a target", () => {
  render(
    <Breadcrumb
      crumbs={[{ label: "Kibo", target: { kind: "project", projectId: "p1" } }]}
      onOpen={() => {}}
    />,
  );
  expect(screen.queryByRole("button")).toBeNull();
});

test("crumbsFor gives a project target to the project crumb and a page target to the page crumb", () => {
  const project = { kind: "project", projectId: "kibo" } as const;
  expect(crumbsFor({ kind: "page", projectId: "kibo", pageId: "1@1" }, ctx)).toEqual([
    { label: "Kibo", target: project, color: "#F97316" },
    { label: "Board", target: null },
  ]);
  expect(crumbsFor({ kind: "ticket", projectId: "kibo", ticketId: "t12" }, ctx)).toEqual([
    { label: "Kibo", target: project, color: "#F97316" },
    { label: "KIB-12", target: null },
  ]);
  expect(crumbsFor({ kind: "project", projectId: "kibo" }, ctx)).toEqual([
    { label: "Kibo", target: null, color: "#F97316" },
  ]);
  expect(
    crumbsFor({ kind: "file", projectId: "kibo", worktree: null, path: "src/a.ts", line: null }, ctx),
  ).toEqual([
    { label: "Kibo", target: project, color: "#F97316" },
    { label: "src/a.ts", target: null },
  ]);
});

test("the Changements crumb opens the changes of the same worktree", () => {
  const changes: TabTarget = { kind: "changes", projectId: "kibo", worktree: "/w/kib-12" };
  expect(crumbsFor(changes, { project: kibo, branch: "kib-12" })).toEqual([
    { label: "Kibo", target: { kind: "project", projectId: "kibo" }, color: "#F97316" },
    { label: "Changements", target: changes },
    { label: "kib-12", target: null },
  ]);
  expect(crumbsFor(changes, ctx)).toEqual([
    { label: "Kibo", target: { kind: "project", projectId: "kibo" }, color: "#F97316" },
    { label: "Changements", target: null },
  ]);
});

test("screens and the inbox: settings crumbs stay text, the inbox crumb opens the inbox screen", () => {
  expect(crumbsFor({ kind: "screen", screen: "general" }, ctx)).toEqual([
    { label: "Paramètres", target: null },
    { label: "Général", target: null },
  ]);
  const inbox: ProjectSnapshot = {
    ...kibo,
    meta: {
      id: INBOX_ID,
      key: "INB",
      name: "Inbox",
      folder: null,
      color: "#64748B",
      worktree: null,
      storybook: null,
      duplication: null,
      delivery: null,
      tracking: null,
      description: null,
      client: null,
    },
  };
  expect(
    crumbsFor({ kind: "ticket", projectId: INBOX_ID, ticketId: "t12" }, { project: inbox, branch: null }),
  ).toEqual([
    { label: "Boîte de réception", target: { kind: "screen", screen: "inbox" }, color: "#64748B" },
    { label: "KIB-12", target: null },
  ]);
});

test("the Créations screen sits under Composants, whose crumb opens the components screen", () => {
  expect(crumbsFor({ kind: "screen", screen: "creations" }, ctx)).toEqual([
    { label: "Composants", target: { kind: "screen", screen: "components" } },
    { label: "Créations", target: null },
  ]);
});

test("a feature sits under the Planning page: « Silo / Planning / F5 · title »", async () => {
  const { siloFeatureProject } = await import("./feature/fixture");
  const base = siloFeatureProject();
  const silo: ProjectSnapshot = {
    ...base,
    pages: [{ id: "p-plan", title: "Planning", kind: "view", parentId: null }],
    instances: [
      {
        id: "i-plan",
        pageId: "p-plan",
        component: "planning@1.0.0",
        layout: { x: 0, y: 0, w: 12, h: 8 },
        config: {},
        componentHash: null,
      },
    ],
  };
  const project = { kind: "project", projectId: "silo" } as const;
  expect(
    crumbsFor({ kind: "ticket", projectId: "silo", ticketId: "f5" }, { project: silo, branch: null }),
  ).toEqual([
    { label: "Silo", target: project, color: "#14B8A6" },
    { label: "Planning", target: { kind: "page", projectId: "silo", pageId: "p-plan" } },
    { label: "F5 · Envoyer les photos d'un constat", target: null },
  ]);
  expect(
    crumbsFor({ kind: "ticket", projectId: "silo", ticketId: "f5" }, { project: base, branch: null }),
  ).toEqual([
    { label: "Silo", target: project, color: "#14B8A6" },
    { label: "F5 · Envoyer les photos d'un constat", target: null },
  ]);
});
