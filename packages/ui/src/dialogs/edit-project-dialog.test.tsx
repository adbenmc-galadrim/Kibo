import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type ProjectSummary, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let fail: KiboError | null = null;
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        if (fail) throw fail;
        if (req.method === "updateProject")
          return {
            id: "kibo",
            key: "KIB",
            name: "Noyau",
            folder: null,
            color: "#6366F1",
            worktree: null,
            storybook: null,
          };
        if (req.method === "setIcon") return { icon: req.icon ? "abc" : null };
        throw new Error(`unexpected ${req.method}`);
      },
    },
  }),
);
const { EditProjectDialog } = await import("./EditProjectDialog");

const project: ProjectSummary = {
  id: "kibo",
  key: "KIB",
  name: "Kibo",
  folder: "/Users/adam/code/kibo",
  color: "#F97316",
  worktree: null,
  storybook: null,
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

const worktreeSection = () => screen.queryByRole("group", { name: "Worktrees des agents" });
const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

test("the worktree section needs a local folder and a local session (screen 167)", () => {
  const { unmount } = render(
    <EditProjectDialog project={{ ...project, folder: null }} remote={false} onClose={() => {}} />,
  );
  expect(worktreeSection()).toBeNull();
  unmount();
  const remote = render(<EditProjectDialog project={project} remote onClose={() => {}} />);
  expect(worktreeSection()).toBeNull();
  remote.unmount();
  render(<EditProjectDialog project={project} remote={false} onClose={() => {}} />);
  expect(worktreeSection()).toBeTruthy();
  expect([field("Base").value, field("Chemin").value, field("Commande de préparation").value]).toEqual([
    "main",
    ".kibo/worktrees/{slug}",
    "",
  ]);
  expect(saveButton().hasAttribute("disabled")).toBe(true);
});

test("saving the worktree section sends the local settings only", async () => {
  const closed = mock(() => {});
  render(<EditProjectDialog project={project} remote={false} onClose={closed} />);
  const user = userEvent.setup();
  await user.clear(field("Base"));
  await user.type(field("Base"), "origin/dev");
  await user.clear(field("Chemin"));
  await user.type(field("Chemin"), "../emis-{{slug}");
  await user.type(field("Commande de préparation"), "pnpm worktree {{branch}");
  await user.click(saveButton());
  await waitFor(() => expect(closed).toHaveBeenCalled());
  expect(calls).toEqual([
    {
      method: "updateProject",
      projectId: "kibo",
      patch: {
        worktree: { baseRef: "origin/dev", pathTemplate: "../emis-{slug}", setup: "pnpm worktree {branch}" },
      },
    },
  ]);
});

test("a path out of the repository is explained and blocks the save", async () => {
  render(<EditProjectDialog project={project} remote={false} onClose={() => {}} />);
  const user = userEvent.setup();
  await user.clear(field("Chemin"));
  await user.type(field("Chemin"), "/tmp/{{slug}");
  expect(screen.getByText("Le chemin doit rester dans le dépôt ou à côté de lui.")).toBeTruthy();
  expect(saveButton().hasAttribute("disabled")).toBe(true);
  await user.clear(field("Chemin"));
  await user.type(field("Chemin"), "../x");
  await user.clear(field("Base"));
  await user.type(field("Base"), "origin/");
  expect(
    screen.getByText("La base doit être une branche (main) ou une branche distante (origin/dev)."),
  ).toBeTruthy();
  expect(saveButton().hasAttribute("disabled")).toBe(true);
});

test("a variable between single quotes is explained and blocks the save", async () => {
  render(<EditProjectDialog project={project} remote={false} onClose={() => {}} />);
  const user = userEvent.setup();
  await user.type(field("Commande de préparation"), "pnpm worktree '{{branch}'");
  expect(
    screen.getByText(
      "Une variable entre guillemets simples ne serait pas remplacée : utilise des guillemets doubles.",
    ),
  ).toBeTruthy();
  expect(saveButton().hasAttribute("disabled")).toBe(true);
});

test("clearing the three fields forgets the settings", async () => {
  const closed = mock(() => {});
  const worktree = { baseRef: "origin/dev", pathTemplate: "../emis-{slug}", setup: "make wt" };
  render(<EditProjectDialog project={{ ...project, worktree }} remote={false} onClose={closed} />);
  expect(field("Commande de préparation").value).toBe("make wt");
  const user = userEvent.setup();
  for (const name of ["Base", "Chemin", "Commande de préparation"]) await user.clear(field(name));
  await user.click(saveButton());
  await waitFor(() => expect(closed).toHaveBeenCalled());
  expect(calls).toEqual([{ method: "updateProject", projectId: "kibo", patch: { worktree: null } }]);
});

const storybookSection = () => screen.queryByRole("group", { name: "Storybook" });
const ORIGIN = "Adresse";
const PORT_ENV = "Variable du port dans .env des worktrees";

test("the storybook section shows the defaults, the port variable only with a local folder (screen 182)", () => {
  const local = render(<EditProjectDialog project={project} remote={false} onClose={() => {}} />);
  expect(storybookSection()).toBeTruthy();
  expect([field(ORIGIN).value, field(PORT_ENV).value]).toEqual(["http://localhost:6006", "STORYBOOK_PORT"]);
  expect(saveButton().hasAttribute("disabled")).toBe(true);
  local.unmount();
  const noFolder = render(
    <EditProjectDialog project={{ ...project, folder: null }} remote={false} onClose={() => {}} />,
  );
  expect(field(ORIGIN).value).toBe("http://localhost:6006");
  expect(screen.queryByLabelText(PORT_ENV)).toBeNull();
  noFolder.unmount();
  render(<EditProjectDialog project={project} remote onClose={() => {}} />);
  expect(storybookSection()).toBeTruthy();
  expect(field(ORIGIN).value).toBe("http://localhost:6006");
  expect(screen.queryByLabelText(PORT_ENV)).toBeNull();
});

test("a deployed storybook is saved with the default port variable", async () => {
  const closed = mock(() => {});
  render(<EditProjectDialog project={project} remote={false} onClose={closed} />);
  const user = userEvent.setup();
  await user.clear(field(ORIGIN));
  await user.type(field(ORIGIN), "https://sb.example.com");
  await user.click(saveButton());
  await waitFor(() => expect(closed).toHaveBeenCalled());
  expect(calls).toEqual([
    {
      method: "updateProject",
      projectId: "kibo",
      patch: { storybook: { origin: "https://sb.example.com", portEnv: "STORYBOOK_PORT" } },
    },
  ]);
});

test("an insecure address or a bad variable name is explained and blocks the save", async () => {
  render(<EditProjectDialog project={project} remote={false} onClose={() => {}} />);
  const user = userEvent.setup();
  await user.clear(field(ORIGIN));
  await user.type(field(ORIGIN), "http://sb.example.com");
  expect(screen.getByText("Adresse refusée (https, ou http en local)")).toBeTruthy();
  expect([field(ORIGIN), field(PORT_ENV)].map((f) => f.getAttribute("aria-invalid"))).toEqual([
    "true",
    "false",
  ]);
  expect(saveButton().hasAttribute("disabled")).toBe(true);
  await user.clear(field(ORIGIN));
  await user.type(field(ORIGIN), "http://localhost:6007");
  expect(screen.queryByText("Adresse refusée (https, ou http en local)")).toBeNull();
  await user.clear(field(PORT_ENV));
  await user.type(field(PORT_ENV), "storybook-port");
  expect(screen.getByText("Nom de variable invalide")).toBeTruthy();
  expect(saveButton().hasAttribute("disabled")).toBe(true);
});

test("clearing both storybook fields forgets the settings", async () => {
  const closed = mock(() => {});
  const storybook = { origin: "https://sb.example.com", portEnv: "SB_PORT" };
  render(<EditProjectDialog project={{ ...project, storybook }} remote={false} onClose={closed} />);
  expect([field(ORIGIN).value, field(PORT_ENV).value]).toEqual(["https://sb.example.com", "SB_PORT"]);
  const user = userEvent.setup();
  await user.clear(field(ORIGIN));
  await user.clear(field(PORT_ENV));
  await user.click(saveButton());
  await waitFor(() => expect(closed).toHaveBeenCalled());
  expect(calls).toEqual([{ method: "updateProject", projectId: "kibo", patch: { storybook: null } }]);
});

test("the defaults typed back over an empty setting send no patch", async () => {
  render(<EditProjectDialog project={project} remote={false} onClose={() => {}} />);
  const user = userEvent.setup();
  await user.clear(field(PORT_ENV));
  await user.type(field(PORT_ENV), "STORYBOOK_PORT");
  expect(saveButton().hasAttribute("disabled")).toBe(true);
});
