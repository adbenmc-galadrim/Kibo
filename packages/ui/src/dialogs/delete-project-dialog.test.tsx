import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type ProjectSnapshot, type ProjectSummary, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { kiboProject } from "../agents/fixtures";

const calls: RpcRequest[] = [];
let fail: KiboError | null = null;
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (fail) throw fail;
      return null;
    },
  },
}));
const { DeleteProjectDialog } = await import("./DeleteProjectDialog");

const project: ProjectSummary = {
  id: "kibo",
  key: "KIB",
  name: "Kibo",
  folder: "/Users/adam/code/kibo",
  color: "#F97316",
  counts: { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 },
};
const local = (): ProjectSnapshot => kiboProject();
const shared = (
  role: "owner" | "editor",
  access: ProjectSnapshot["sync"]["access"] = "write",
): ProjectSnapshot => ({
  ...kiboProject(),
  sync: { shared: true, keyAllocator: "server", role, access, members: [] },
});
const handlers = () => ({
  onClose: mock(() => {}),
  onDeleted: mock(() => {}),
  onOpenAgents: mock(() => {}),
  onShare: mock(() => {}),
});
beforeEach(() => {
  calls.length = 0;
  fail = null;
});

test("deletes after the exact name is typed, spaces around ignored, case respected (screen 108)", async () => {
  const h = handlers();
  const snapshot = local();
  render(<DeleteProjectDialog project={project} snapshot={snapshot} activeRuns={0} {...h} />);
  expect(screen.getByRole("dialog", { name: "Supprimer le projet Kibo ?" })).toBeTruthy();
  expect(snapshot.tickets.length).toBe(4);
  expect(screen.getByText("4 tickets, 0 page et 0 widget seront supprimés.")).toBeTruthy();
  expect(screen.getByText("/Users/adam/code/kibo").parentElement?.textContent).toMatch(
    /^Le dossier \/Users\/adam\/code\/kibo et ses fichiers ne sont pas touchés/,
  );
  const confirm = screen.getByRole("button", { name: "Supprimer" });
  expect(confirm.hasAttribute("disabled")).toBe(true);
  const user = userEvent.setup();
  const field = screen.getByLabelText("Tape Kibo pour confirmer");
  await user.type(field, "kibo{Enter}");
  expect(confirm.hasAttribute("disabled")).toBe(true);
  expect(calls).toEqual([]);
  await user.clear(field);
  await user.type(field, "  Kibo ");
  expect(confirm.hasAttribute("disabled")).toBe(false);
  await user.click(confirm);
  await waitFor(() => expect(h.onDeleted).toHaveBeenCalledWith("kibo"));
  expect(calls).toEqual([{ method: "deleteProject", projectId: "kibo" }]);
});

test("active runs block the deletion and lead to the agents", async () => {
  const h = handlers();
  render(<DeleteProjectDialog project={project} snapshot={local()} activeRuns={2} {...h} />);
  expect(screen.getByRole("dialog", { name: "Des agents travaillent sur ce projet" })).toBeTruthy();
  expect(
    screen.getByText("2 runs en cours ou en file : arrête-les avant de supprimer le projet."),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: "Voir les agents" }));
  expect(h.onOpenAgents).toHaveBeenCalled();
  expect(calls).toEqual([]);
});

test("the owner of a shared project is sent to the sharing dialog", async () => {
  const h = handlers();
  render(<DeleteProjectDialog project={project} snapshot={shared("owner")} activeRuns={0} {...h} />);
  expect(screen.getByRole("dialog", { name: "Ce projet est partagé" })).toBeTruthy();
  expect(screen.getByText(/Tu en es propriétaire/)).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir le partage" }));
  expect(h.onShare).toHaveBeenCalled();
  expect(calls).toEqual([]);
});

test("a member or a revoked owner leaves the project", async () => {
  for (const snapshot of [shared("editor"), shared("owner", "revoked")]) {
    const h = handlers();
    const view = render(<DeleteProjectDialog project={project} snapshot={snapshot} activeRuns={0} {...h} />);
    expect(screen.getByRole("dialog", { name: "Quitter le projet Kibo ?" })).toBeTruthy();
    expect(screen.getByText(/Ta copie locale sera supprimée/)).toBeTruthy();
    expect(screen.queryByText(/seront supprimés/)).toBeNull();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Tape Kibo pour confirmer"), "Kibo");
    await user.click(screen.getByRole("button", { name: "Quitter le projet" }));
    await waitFor(() => expect(h.onDeleted).toHaveBeenCalledWith("kibo"));
    view.unmount();
  }
  expect(calls).toEqual([
    { method: "deleteProject", projectId: "kibo" },
    { method: "deleteProject", projectId: "kibo" },
  ]);
});

test("without a snapshot the generic text shows; daemon refusals are explained", async () => {
  fail = new KiboError("CONFLICT", "project kibo has active runs");
  const h = handlers();
  render(
    <DeleteProjectDialog project={{ ...project, folder: null }} snapshot={null} activeRuns={0} {...h} />,
  );
  expect(
    screen.getByText("Les notes restent sur le disque ; l'historique des runs est conservé."),
  ).toBeTruthy();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Tape Kibo pour confirmer"), "Kibo");
  await user.click(screen.getByRole("button", { name: "Supprimer" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Impossible de supprimer le projet. Un run du projet est en cours, ou tu en es propriétaire alors qu'il est partagé : arrête les runs ou le partage d'abord.",
  );
  fail = new KiboError("FORBIDDEN", "local session required");
  await user.click(screen.getByRole("button", { name: "Supprimer" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Impossible de supprimer le projet. Supprimer un projet n'est possible que depuis l'ordinateur où tourne Kibo.",
    ),
  );
  expect(h.onDeleted).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Supprimer le projet Kibo ?" })).toBeTruthy();
});

test("a 120-character folder wraps instead of overflowing (screen 108)", async () => {
  const folder = `/srv/${"dossier-tres-long/".repeat(6)}kibo/v2`;
  render(
    <DeleteProjectDialog
      project={{ ...project, folder }}
      snapshot={local()}
      activeRuns={0}
      {...handlers()}
    />,
  );
  const text = await screen.findByText(new RegExp(folder.slice(0, 30)));
  expect(folder).toHaveLength(120);
  expect(text.className).toContain("break-all");
  expect(text.closest("[data-slot=dialog-description]")?.className).toContain("min-w-0");
});
