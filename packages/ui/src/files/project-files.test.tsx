import { beforeEach, expect, mock, spyOn, test } from "bun:test";
import { KiboError, type ProjectAsset, type RpcRequest } from "@kibo/schema";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let assets: ProjectAsset[] = [];
let refuse: (req: RpcRequest) => Error | null = () => null;
let appendGate: Promise<void> | null = null;
const answer = (req: RpcRequest): unknown => {
  switch (req.method) {
    case "listAssets":
      return assets;
    case "getFilesDir":
      return { dir: "/home/adam/.kibo/files/KIB", displayDir: "~/.kibo/files/KIB", used: 420 };
    case "setFilesDir":
      return { dir: req.dir ?? "", displayDir: req.dir ?? "", used: 0 };
    case "beginAssetUpload":
      return { uploadId: "u1" };
    case "appendAssetUpload":
      return { received: 8 };
    case "finishAssetUpload":
      return { name: "robot.glb", mime: "model/gltf-binary", kind: "model", size: 8, mtime: 0 };
    default:
      return null;
  }
};
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "appendAssetUpload" && appendGate) await appendGate;
      const error = refuse(req);
      if (error) throw error;
      return answer(req);
    },
  },
}));
const { ProjectFilesDialog } = await import("./ProjectFilesDialog");

const robot: ProjectAsset = {
  name: "robot.glb",
  mime: "model/gltf-binary",
  kind: "model",
  size: 400,
  mtime: 0,
};
const beep: ProjectAsset = { name: "beep.wav", mime: "audio/wav", kind: "audio", size: 20, mtime: 0 };

beforeEach(() => {
  calls.length = 0;
  assets = [robot, beep];
  refuse = () => null;
  appendGate = null;
});

const show = () => {
  const onClose = mock(() => {});
  const { unmount } = render(<ProjectFilesDialog projectId="p1" onClose={onClose} />);
  return { onClose, unmount, user: userEvent.setup() };
};
const methods = () => calls.map((c) => c.method);
const glb = (name: string, type = "application/octet-stream") =>
  new File([new TextEncoder().encode("glTF\u0002\u0000\u0000\u0000")], name, { type });
const pick = (...files: File[]) =>
  fireEvent.change(screen.getByLabelText("Choisir des fichiers à importer"), { target: { files } });

test("lists the project files and the folder with its usage", async () => {
  show();
  expect(screen.getByRole("dialog", { name: "Fichiers du projet" })).toBeTruthy();
  const table = await screen.findByRole("table", { name: "Fichiers du projet" });
  const rows = within(table)
    .getAllByRole("row")
    .slice(1)
    .map((r) =>
      within(r)
        .getAllByRole("cell")
        .slice(0, 3)
        .map((c) => c.textContent),
    );
  expect(rows).toEqual([
    ["robot.glb", "Modèle", "400 o"],
    ["beep.wav", "Son", "20 o"],
  ]);
  expect(await screen.findByText("Dossier : ~/.kibo/files/KIB · 420 o utilisés")).toBeTruthy();
});

test("an empty folder explains how to get a .glb", async () => {
  assets = [];
  show();
  expect(
    await screen.findByText(
      "Aucun fichier. Exporte depuis Blender en glTF Binary (.glb), ou dépose des images et des sons.",
    ),
  ).toBeTruthy();
});

test("Supprimer asks for confirmation, removes, then reloads the list", async () => {
  const { user } = show();
  await user.click(await screen.findByRole("button", { name: "Supprimer robot.glb" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Supprimer robot.glb ?" });
  calls.length = 0;
  assets = [beep];
  await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
  await waitFor(() => expect(screen.queryByRole("cell", { name: "robot.glb" })).toBeNull());
  expect(calls[0]).toEqual({ method: "removeAsset", projectId: "p1", name: "robot.glb" });
  expect(methods()).toContain("listAssets");
});

test("an imported file is renamed, typed from its extension, sent in chunks, then listed", async () => {
  assets = [];
  show();
  await screen.findByText(/^Aucun fichier/);
  calls.length = 0;
  assets = [robot];
  pick(glb("Robot.GLB"));
  expect(await screen.findByRole("cell", { name: "robot.glb" })).toBeTruthy();
  expect(calls[0]).toEqual({
    method: "beginAssetUpload",
    projectId: "p1",
    name: "robot.glb",
    mime: "model/gltf-binary",
    size: 8,
  });
  expect(methods().slice(1, 3)).toEqual(["appendAssetUpload", "finishAssetUpload"]);
  expect(methods()).toContain("listAssets");
  expect(screen.queryByRole("alert")).toBeNull();
});

test("an unsupported format is refused before any call", async () => {
  show();
  await screen.findByRole("table");
  calls.length = 0;
  pick(glb("scene.gltf", "model/gltf+json"));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "scene.gltf · Format non pris en charge : .gltf",
  );
  expect(calls).toEqual([]);
});

test("a file over 64 Mio is refused before any call", async () => {
  show();
  await screen.findByRole("table");
  calls.length = 0;
  const big = glb("big.glb");
  Object.defineProperty(big, "size", { value: 64 * 1024 * 1024 + 1 });
  pick(big);
  expect((await screen.findByRole("alert")).textContent).toBe("big.glb · Trop gros : 64 Mio maximum.");
  expect(calls).toEqual([]);
});

test.each([
  ["CONFLICT", "beginAssetUpload", "Un fichier porte déjà ce nom."],
  ["QUOTA_EXCEEDED", "beginAssetUpload", "Dossier plein : 512 Mio maximum."],
  ["RATE_LIMITED", "beginAssetUpload", "4 envois en cours au maximum : attends la fin d'un envoi."],
  ["NOT_FOUND", "appendAssetUpload", "Envoi expiré après 10 min d'inactivité : relance l'import."],
  ["INVALID_INPUT", "finishAssetUpload", "Le contenu ne correspond pas à l'extension."],
  ["INTERNAL", "finishAssetUpload", "Ce dossier ne permet pas les liens durs : choisis un autre dossier."],
] as const)("a %s refusal on %s is explained", async (code, method, text) => {
  refuse = (req) => (req.method === method ? new KiboError(code, "refused") : null);
  show();
  await screen.findByRole("table");
  pick(glb("Robot.glb"));
  expect((await screen.findByRole("alert")).textContent).toBe(`robot.glb · ${text}`);
  if (method !== "beginAssetUpload") expect(methods()).toContain("cancelAssetUpload");
});

test("several files are sent one after the other", async () => {
  show();
  await screen.findByRole("table");
  calls.length = 0;
  pick(glb("a.glb"), glb("b.glb"));
  await waitFor(() => expect(methods().filter((m) => m === "finishAssetUpload")).toHaveLength(2));
  const sends = methods().filter((m) => m !== "listAssets" && m !== "getFilesDir");
  expect(sends).toEqual([
    "beginAssetUpload",
    "appendAssetUpload",
    "finishAssetUpload",
    "beginAssetUpload",
    "appendAssetUpload",
    "finishAssetUpload",
  ]);
});

test("Changer… sets the files folder and reloads", async () => {
  const { user } = show();
  await user.click(await screen.findByRole("button", { name: "Changer…" }));
  const dialog = await screen.findByRole("dialog", { name: "Dossier des fichiers" });
  const field = within(dialog).getByLabelText("Dossier") as HTMLInputElement;
  await waitFor(() => expect(field.value).toBe("/home/adam/.kibo/files/KIB"));
  await user.clear(field);
  await user.type(field, "/tmp/kibo");
  calls.length = 0;
  await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(methods()).toContain("getFilesDir"));
  expect(calls[0]).toEqual({ method: "setFilesDir", projectId: "p1", dir: "/tmp/kibo" });
  expect(methods()).toContain("listAssets");
});

test("a failed listing is shown", async () => {
  refuse = (req) => (req.method === "listAssets" ? new Error("down") : null);
  const error = spyOn(console, "error").mockImplementation(() => {});
  show();
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de lister les fichiers du projet.");
  error.mockRestore();
});

test("an empty file is refused before any call", async () => {
  show();
  await screen.findByRole("table");
  calls.length = 0;
  pick(new File([], "vide.glb"));
  expect((await screen.findByRole("alert")).textContent).toBe("vide.glb · Fichier vide.");
  expect(calls).toEqual([]);
});

test("closing during a send cancels once the append in flight settled, then stays silent", async () => {
  let release = () => {};
  appendGate = new Promise((resolve) => {
    release = resolve;
  });
  const { unmount } = show();
  await screen.findByRole("table");
  calls.length = 0;
  pick(glb("a.glb"), glb("b.glb"));
  await waitFor(() => expect(methods()).toEqual(["beginAssetUpload", "appendAssetUpload"]));
  unmount();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(methods()).not.toContain("cancelAssetUpload");
  release();
  await waitFor(() => expect(methods()).toContain("cancelAssetUpload"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(methods()).toEqual(["beginAssetUpload", "appendAssetUpload", "cancelAssetUpload"]);
  expect(screen.queryByRole("alert")).toBeNull();
});
