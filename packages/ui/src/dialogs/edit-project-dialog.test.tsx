import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type ProjectSummary, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let fail: KiboError | null = null;
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (fail) throw fail;
      if (req.method === "updateProject")
        return { id: "kibo", key: "KIB", name: "Noyau", folder: null, color: "#6366F1", worktree: null };
      if (req.method === "setIcon") return { icon: req.icon ? "abc" : null };
      throw new Error(`unexpected ${req.method}`);
    },
  },
}));
const { EditProjectDialog } = await import("./EditProjectDialog");

const project: ProjectSummary = {
  id: "kibo",
  key: "KIB",
  name: "Kibo",
  folder: "/Users/adam/code/kibo",
  color: "#F97316",
  worktree: null,
  counts: { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 },
  icon: "v1",
};
const PNG = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "logo.png", {
  type: "image/png",
});
const saveButton = () => screen.getByRole("button", { name: "Enregistrer" });
beforeEach(() => {
  calls.length = 0;
  fail = null;
});

test("shows the current values and saves only the changed fields, then the icon (screen 107)", async () => {
  const closed = mock(() => {});
  render(<EditProjectDialog project={project} remote={false} onClose={closed} />);
  expect(screen.getByRole("dialog", { name: "Modifier le projet" })).toBeTruthy();
  expect((screen.getByLabelText("Nom") as HTMLInputElement).value).toBe("Kibo");
  expect((screen.getByLabelText("Dossier") as HTMLInputElement).value).toBe("/Users/adam/code/kibo");
  expect(screen.getByRole("img", { name: "Image · Image" }).getAttribute("src")).toBe(
    "/icons/project/kibo?v=v1",
  );
  const user = userEvent.setup();
  const name = screen.getByLabelText("Nom");
  await user.clear(name);
  await user.type(name, "Noyau");
  await user.click(screen.getByRole("radio", { name: "Couleur #6366F1" }));
  await user.clear(screen.getByLabelText("Dossier"));
  await user.upload(screen.getByLabelText("Choisir une image…"), PNG);
  await user.click(saveButton());
  await waitFor(() => expect(closed).toHaveBeenCalled());
  expect(calls).toEqual([
    {
      method: "updateProject",
      projectId: "kibo",
      patch: { name: "Noyau", color: "#6366F1", folder: null },
    },
    {
      method: "setIcon",
      owner: { kind: "project", projectId: "kibo" },
      icon: { mime: "image/png", data: "iVBORw0KGgo=" },
    },
  ]);
});

test("removing the image alone sends only setIcon with null", async () => {
  const closed = mock(() => {});
  render(<EditProjectDialog project={project} remote={false} onClose={closed} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Retirer l'image" }));
  await user.click(saveButton());
  await waitFor(() => expect(closed).toHaveBeenCalled());
  expect(calls).toEqual([{ method: "setIcon", owner: { kind: "project", projectId: "kibo" }, icon: null }]);
});

test("nothing changed keeps the button disabled; a blank name is refused before any call", async () => {
  render(<EditProjectDialog project={project} remote={false} onClose={() => {}} />);
  expect(saveButton().hasAttribute("disabled")).toBe(true);
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("Nom"));
  await user.type(screen.getByLabelText("Nom"), "   ");
  expect(saveButton().hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByLabelText("Nom"), "{Enter}");
  expect(calls).toEqual([]);
});

test("a busy folder explains itself and keeps the dialog open with the old name on screen", async () => {
  fail = new KiboError("CONFLICT", "project kibo has active runs");
  const closed = mock(() => {});
  render(<EditProjectDialog project={project} remote={false} onClose={closed} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Dossier"), "2");
  await user.click(saveButton());
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Un agent travaille sur ce projet : attends la fin de ses runs pour changer le dossier.",
  );
  expect(screen.getByRole("dialog", { name: "Modifier le projet" })).toBeTruthy();
  expect((screen.getByLabelText("Nom") as HTMLInputElement).value).toBe("Kibo");
  fail = new KiboError("INVALID_INPUT", "folder does not exist");
  await user.click(saveButton());
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Impossible de modifier le projet. Le nom ne peut pas être vide et le dossier doit être un chemin absolu vers un dossier existant.",
    ),
  );
  fail = new KiboError("FORBIDDEN", "read-only");
  await user.click(saveButton());
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Impossible de modifier le projet. Ce projet est en lecture seule pour toi.",
    ),
  );
  expect(closed).not.toHaveBeenCalled();
});

test("a remote session has no folder field and never sends a folder", async () => {
  const closed = mock(() => {});
  render(<EditProjectDialog project={project} remote onClose={closed} />);
  expect(screen.queryByLabelText("Dossier")).toBeNull();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nom"), " 2");
  await user.click(saveButton());
  await waitFor(() => expect(closed).toHaveBeenCalled());
  expect(calls).toEqual([{ method: "updateProject", projectId: "kibo", patch: { name: "Kibo 2" } }]);
});

test("a folder picker error then a save error leave a single alert, the latest one", async () => {
  const pick = mock(() => Promise.reject(new Error("dialog plugin down")));
  render(<EditProjectDialog project={project} remote={false} onClose={() => {}} canBrowse pick={pick} />);
  const user = userEvent.setup({ applyAccept: false });
  await user.click(screen.getByRole("button", { name: "Parcourir…" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'ouvrir le sélecteur de dossier.");
  fail = new KiboError("FORBIDDEN", "read-only");
  await user.type(screen.getByLabelText("Nom"), " 2");
  await user.click(saveButton());
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Impossible de modifier le projet. Ce projet est en lecture seule pour toi.",
    ),
  );
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  await user.upload(
    screen.getByLabelText("Choisir une image…"),
    new File(["<svg/>"], "a.svg", { type: "image/svg+xml" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe("Format non pris en charge : PNG, JPEG ou WebP."),
  );
  expect(screen.getAllByRole("alert")).toHaveLength(1);
});
