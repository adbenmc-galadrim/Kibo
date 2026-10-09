import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  KiboError,
  type ProjectSnapshot,
  type ProjectSyncInfo,
  type RpcRequest,
  type SyncStatus,
} from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let results: Partial<Record<RpcRequest["method"], () => Promise<unknown>>> = {};
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return (results[req.method] ?? (() => Promise.resolve(null)))();
      },
      subscribeEvents: () => () => undefined,
    },
  }),
);

const { ShareProjectDialog } = await import("./ShareProjectDialog");
const { JoinProjectDialog } = await import("./JoinProjectDialog");
const { ProjectAccessBanner } = await import("../shell/ProjectAccessBanner");

const USED = "; the invite is used: the project owner must remove this member, then invite again";
const local: ProjectSyncInfo = {
  shared: false,
  keyAllocator: "local",
  role: null,
  access: "write",
  members: [],
};
const owned: ProjectSyncInfo = {
  shared: true,
  keyAllocator: "server",
  role: "owner",
  access: "write",
  members: [
    { userId: "u-adam", name: "Adam", role: "owner" },
    { userId: "u-lea", name: "Léa", role: "editor" },
  ],
};
const project = (sync: ProjectSyncInfo): ProjectSnapshot => ({
  meta: {
    id: "p1",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#14B8A6",
    worktree: null,
    storybook: null,
  },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  questions: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: null,
  sync,
});
const online: SyncStatus = {
  state: "online",
  serverUrl: "wss://sync.kibo.test",
  user: { id: "u-adam", name: "Adam" },
  deviceId: "d1",
  retryAt: null,
  lastError: null,
  projects: [],
};
const logs = ["log", "info", "warn", "error", "debug"] as const;
const spies = logs.map((m) => spyOn(console, m));

beforeEach(() => {
  calls.length = 0;
  results = { getSyncStatus: () => Promise.resolve(online) };
  for (const s of spies) s.mockClear();
});
afterEach(() => {
  location.hash = "";
});

const logged = () => spies.flatMap((s) => s.mock.calls.map((c) => c.map(String).join(" ")));

test("before sharing, the dialog lists what leaves and what stays", async () => {
  render(<ShareProjectDialog project={project(local)} open onOpenChange={() => {}} />);
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Partager « Kibo »")).toBeTruthy();
  const sent = within(dialog).getByRole("list", { name: "Envoyé au serveur" });
  expect(within(sent).getByText("Tickets et sous-tickets")).toBeTruthy();
  const kept = within(dialog).getByRole("list", { name: "Reste sur ta machine" });
  expect(within(kept).getByText("Dossier local")).toBeTruthy();
  expect(within(kept).getByText("Secrets et serveurs MCP")).toBeTruthy();
  expect(within(dialog).getByText("Le serveur voit les données en clair.")).toBeTruthy();
  expect(await within(dialog).findByText("wss://sync.kibo.test")).toBeTruthy();
});

test("without a server the share button is disabled", async () => {
  results.getSyncStatus = () => Promise.resolve({ ...online, state: "unconfigured", serverUrl: null });
  render(<ShareProjectDialog project={project(local)} open onOpenChange={() => {}} remote={false} />);
  expect(await screen.findByText("Configure un serveur dans Paramètres › Synchronisation")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Partager" }) as HTMLButtonElement).disabled).toBe(true);
});

test("from a remote session the server setup is not offered", async () => {
  results.getSyncStatus = () => Promise.resolve({ ...online, state: "unconfigured", serverUrl: null });
  render(<ShareProjectDialog project={project(local)} open onOpenChange={() => {}} remote />);
  expect(
    await screen.findByText("Aucun serveur de sync : il se configure depuis l'ordinateur où tourne Kibo."),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Configure un serveur dans Paramètres › Synchronisation" }),
  ).toBeNull();
});

test("sharing offline explains the failure", async () => {
  results.shareProject = () => Promise.reject(new KiboError("SYNC_OFFLINE", "down"));
  render(<ShareProjectDialog project={project(local)} open onOpenChange={() => {}} />);
  const button = screen.getByRole("button", { name: "Partager" }) as HTMLButtonElement;
  await waitFor(() => expect(button.disabled).toBe(false));
  await userEvent.click(button);
  expect(await screen.findByText("Serveur injoignable, réessaie quand tu es en ligne")).toBeTruthy();
  expect(calls.some((c) => c.method === "shareProject" && c.projectId === "p1")).toBe(true);
});

test("sharing a suspended project is refused with an explicit French message", async () => {
  results.shareProject = () =>
    Promise.reject(
      new KiboError("CONFLICT", "project p1 is already shared but its sync is suspended (TOO_LARGE)"),
    );
  render(<ShareProjectDialog project={project(local)} open onOpenChange={() => {}} />);
  const button = screen.getByRole("button", { name: "Partager" }) as HTMLButtonElement;
  await waitFor(() => expect(button.disabled).toBe(false));
  await userEvent.click(button);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe(
    "Ce projet est déjà partagé mais sa sync est suspendue : il ne peut pas être partagé de nouveau. Il reste modifiable sur cette machine.",
  );
  expect(alert.textContent).not.toContain("CONFLICT");
});

test("an owner sees members, changes roles, removes and invites without leaking the code", async () => {
  results.setMemberRole = () => Promise.resolve([owned.members[0], { ...owned.members[1], role: "viewer" }]);
  results.createProjectInvite = () =>
    Promise.resolve({ code: "ABCDEFGHJKMNPQRSTUVWXYZ234", expiresAt: Date.now() });
  render(<ShareProjectDialog project={project(owned)} open onOpenChange={() => {}} />);
  const members = screen.getByRole("list", { name: "Membres" });
  expect(await within(members).findByText("Adam (toi)")).toBeTruthy();
  const lea = within(members).getByText("Léa").closest("li");
  if (!lea) throw new Error("no member row");
  within(lea).getByRole("combobox", { name: "Rôle de Léa" }).focus();
  await userEvent.keyboard("{ArrowDown}");
  await userEvent.click(await screen.findByRole("option", { name: "Lecteur" }));
  await waitFor(() =>
    expect(calls.find((c) => c.method === "setMemberRole")).toEqual({
      method: "setMemberRole",
      projectId: "p1",
      userId: "u-lea",
      role: "viewer",
    }),
  );
  await userEvent.click(within(lea).getByRole("button", { name: "Retirer" }));
  await waitFor(() => expect(calls.some((c) => c.method === "setMemberRole" && c.role === null)).toBe(true));
  await userEvent.click(screen.getByRole("button", { name: "Générer un code" }));
  expect(await screen.findByText("ABCD EFGH JKMN PQRS TUVW XYZ2 34")).toBeTruthy();
  expect(screen.getByText("Valable 48 h, usage unique")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Arrêter le partage" })).toBeTruthy();
  expect(location.href).not.toContain("ABCDEFGH");
  expect(logged().some((l) => l.includes("ABCDEFGH"))).toBe(false);
});

test("a failed role change is reported in French", async () => {
  results.setMemberRole = () => Promise.reject(new KiboError("FORBIDDEN", "not an owner"));
  render(<ShareProjectDialog project={project(owned)} open onOpenChange={() => {}} />);
  const lea = within(screen.getByRole("list", { name: "Membres" }))
    .getByText("Léa")
    .closest("li");
  if (!lea) throw new Error("no member row");
  await userEvent.click(within(lea).getByRole("button", { name: "Retirer" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe("Seul un propriétaire du projet peut faire cela.");
});

test("an editor sees roles as text and no owner actions", async () => {
  render(<ShareProjectDialog project={project({ ...owned, role: "editor" })} open onOpenChange={() => {}} />);
  expect(await screen.findByText("Adam (toi)")).toBeTruthy();
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.queryByRole("button", { name: "Générer un code" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Arrêter le partage" })).toBeNull();
});

test("a suspended shared project explains that it stays editable locally", async () => {
  results.getSyncStatus = () =>
    Promise.resolve({
      ...online,
      projects: [
        {
          projectId: "p1",
          name: "Kibo",
          role: "owner",
          lastSyncAt: null,
          lastError: "TOO_LARGE",
          accessRevoked: false,
        },
      ],
    });
  render(<ShareProjectDialog project={project(owned)} open onOpenChange={() => {}} />);
  expect((await screen.findByRole("status")).textContent).toBe(
    "Sync suspendue : données trop volumineuses — Modifiable sur cette machine, mais plus synchronisé.",
  );
});

test("joining maps invalid codes and duplicate keys", async () => {
  results.joinProject = () => Promise.reject(new KiboError("INVITE_INVALID", "bad"));
  render(<JoinProjectDialog open onOpenChange={() => {}} />);
  await userEvent.type(screen.getByLabelText("Code d'invitation"), "ABCD");
  await userEvent.click(screen.getByRole("button", { name: "Rejoindre" }));
  expect(await screen.findByText("Code invalide ou expiré")).toBeTruthy();
  results.joinProject = () => Promise.reject(new KiboError("INVALID_INPUT", "duplicate project key KIB"));
  await userEvent.click(screen.getByRole("button", { name: "Rejoindre" }));
  expect(await screen.findByText("Un projet local utilise déjà la clé KIB")).toBeTruthy();
  expect(calls.at(-1)).toEqual({ method: "joinProject", code: "ABCD", folder: null });
  expect(location.href).not.toContain("ABCD");
  expect(logged().some((l) => l.includes("ABCD"))).toBe(false);
});

test("a join refused after the code was consumed tells who must act", async () => {
  results.joinProject = () =>
    Promise.reject(new KiboError("INVALID_INPUT", `duplicate project key KIB${USED}`));
  render(<JoinProjectDialog open onOpenChange={() => {}} />);
  await userEvent.type(screen.getByLabelText("Code d'invitation"), "ABCD");
  await userEvent.click(screen.getByRole("button", { name: "Rejoindre" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe(
    "Un projet local utilise déjà la clé KIB. Ce code d'invitation est consommé : le propriétaire du projet doit te retirer des membres, puis t'inviter de nouveau.",
  );
  results.joinProject = () =>
    Promise.reject(new KiboError("SYNC_OFFLINE", `no update received for project p9${USED}`));
  await userEvent.click(screen.getByRole("button", { name: "Rejoindre" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Serveur injoignable, réessaie quand tu es en ligne. Ce code d'invitation est consommé : le propriétaire du projet doit te retirer des membres, puis t'inviter de nouveau.",
    ),
  );
});

test("the banner explains read-only, revoked and suspended access", () => {
  const { rerender, container } = render(<ProjectAccessBanner access="write" />);
  expect(container.childElementCount).toBe(0);
  rerender(<ProjectAccessBanner access="read-only" />);
  expect(screen.getByRole("status").textContent).toBe("Lecture seule — tu es lecteur de ce projet.");
  rerender(<ProjectAccessBanner access="revoked" />);
  expect(screen.getByRole("status").textContent).toBe(
    "Accès retiré — ta copie locale reste lisible mais n'est plus synchronisée.",
  );
  rerender(<ProjectAccessBanner access="write" suspended="INVALID_INPUT" />);
  expect(screen.getByRole("status").textContent).toBe(
    "Sync suspendue : données illisibles — Modifiable sur cette machine, mais plus synchronisé.",
  );
  rerender(<ProjectAccessBanner access="write" suspended="SYNC_OFFLINE" />);
  expect(screen.queryByRole("status")).toBeNull();
});
