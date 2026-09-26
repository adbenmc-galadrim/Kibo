import { beforeEach, expect, mock, test } from "bun:test";
import { type ComponentSummary, type Instance, KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

const H = "c".repeat(64);
const calls: RpcRequest[] = [];
let components: ComponentSummary[] = [];
let answer: (req: RpcRequest) => Promise<unknown> = async () => null;
let runtime: () => Promise<unknown> = async () => ({ sandboxOrigin: "http://127.0.0.1:4318" });

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "listComponents") return Promise.resolve(components);
      if (req.method === "listDrafts") return Promise.resolve([]);
      if (req.method === "getRuntimeInfo") return runtime();
      return answer(req);
    },
    subscribe: () => () => undefined,
    subscribeTopic: () => () => undefined,
  },
}));

const { loadTrusted } = await import("../shell/trusted-loader");
const { InstanceFrame } = await import("./InstanceFrame");
const { InstanceMenu } = await import("./InstanceMenu");
const { NotesDirDialog } = await import("../dialogs/NotesDirDialog");
const { HostProvider } = await import("../shell/Host");

await loadTrusted("mine", "1.0.0", H, async () => ({
  manifest: { id: "mine", version: "1.0.0", kind: "widget", title: "Mine", reads: [], writes: [] },
  Component: () => <p>trusted content</p>,
}));

const host = {
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openAssign: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
  openTarget: () => undefined,
};
const wrap = (node: ReactNode) => render(<HostProvider host={host}>{node}</HostProvider>);
const inst = (component: string): Instance => ({
  id: "i1",
  pageId: "pg",
  component,
  layout: { x: 0, y: 0, w: 6, h: 6 },
  config: {},
});
type Version = ComponentSummary["versions"][number];
const version = (v: string, patch: Partial<Version> = {}): Version => ({
  version: v,
  hash: H,
  trust: "sandboxed",
  origin: "ai",
  active: true,
  tampered: false,
  manifest: {
    id: "pr-queue",
    version: v,
    kind: "widget",
    title: "PR en attente",
    reads: ["ticket"],
    writes: [],
    data: false,
    net: [],
    configVersion: 0,
    changes: [],
    sdk: 1,
  },
  usages: [],
  ...patch,
});
const prQueue = (...versions: Version[]): ComponentSummary[] => [
  { id: "pr-queue", title: "PR en attente", builtin: false, versions },
];

beforeEach(() => {
  calls.length = 0;
  components = [];
  answer = async () => null;
});

test("the sandbox port being unknown is reported instead of rendering nothing", async () => {
  components = prQueue(version("0.3.0"));
  runtime = () => Promise.reject(new KiboError("INVALID_INPUT", "unknown method"));
  const errors: unknown[] = [];
  const log = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    wrap(<InstanceFrame projectId="p1" instance={inst("pr-queue@0.3.0")} viewer="adam" surface="widget" />);
    expect((await screen.findByRole("alert")).textContent).toBe("Impossible de charger le composant.");
    expect(errors).toHaveLength(1);
  } finally {
    console.error = log;
    runtime = async () => ({ sandboxOrigin: "http://127.0.0.1:4318" });
  }
});

test("a sandboxed version is rendered in an isolated iframe served by the sandbox port", async () => {
  components = prQueue(version("0.3.0"));
  const settings: unknown = Reflect.get(Reflect.get(window, "happyDOM"), "settings");
  const loading: unknown = Reflect.get(Object(settings), "disableIframePageLoading");
  Reflect.set(Object(settings), "disableIframePageLoading", true);
  const log = console.error;
  const errors: unknown[] = [];
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    wrap(<InstanceFrame projectId="p1" instance={inst("pr-queue@0.3.0")} viewer="adam" surface="widget" />);
    const frame = await screen.findByTitle("PR en attente");
    expect(frame.getAttribute("src")).toBe(`http://127.0.0.1:4318/c/pr-queue/0.3.0/${H}/index.html`);
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    await waitFor(() => expect(String(errors[0])).toContain("Iframe page loading is disabled"));
  } finally {
    console.error = log;
    Reflect.set(Object(settings), "disableIframePageLoading", loading);
  }
});

test("a trusted version is loaded as a module", async () => {
  components = [
    { id: "mine", title: "Mine", builtin: false, versions: [version("1.0.0", { trust: "trusted" })] },
  ];
  wrap(<InstanceFrame projectId="p1" instance={inst("mine@1.0.0")} viewer="adam" surface="widget" />);
  expect(await screen.findByText("trusted content")).toBeTruthy();
});

test("D2: an unapproved or tampered version asks for trust", async () => {
  components = prQueue(version("0.3.0", { active: false, trust: null }));
  const { unmount } = wrap(
    <InstanceFrame projectId="p1" instance={inst("pr-queue@0.3.0")} viewer="adam" surface="view" />,
  );
  expect((await screen.findByText("Autorisation requise")).closest("[data-tampered]")).toBeNull();
  expect(screen.getByText("« PR en attente » 0.3.0 doit être autorisé avant de s'afficher.")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Examiner et autoriser" }));
  expect(await screen.findByText("Autoriser « PR en attente » 0.3.0 ?")).toBeTruthy();
  unmount();
  components = prQueue(version("0.3.0", { active: false, trust: null, tampered: true }));
  wrap(<InstanceFrame projectId="p1" instance={inst("pr-queue@0.3.0")} viewer="adam" surface="widget" />);
  const changed = await screen.findByText("Son code a changé depuis ton accord.");
  expect(changed.closest("[data-tampered]")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Examiner et autoriser" }).hasAttribute("disabled")).toBe(true);
});

test("a built-in is rendered from the UI bundle, an unknown ref says so", async () => {
  const { unmount } = wrap(
    <InstanceFrame projectId="p1" instance={inst("kanban@1.0.0")} viewer="adam" surface="widget" />,
  );
  await waitFor(() => expect(calls.some((c) => c.method === "getProject")).toBe(true));
  unmount();
  wrap(<InstanceFrame projectId="p1" instance={inst("ghost@9.9.9")} viewer="adam" surface="widget" />);
  expect(await screen.findByText(/ghost@9\.9\.9/)).toBeTruthy();
});

test("D1: update to a higher version, remove from the page", async () => {
  components = prQueue(version("0.3.0"), version("0.4.0"), version("0.5.0"));
  answer = async (req) => (req.method === "updateInstance" ? inst(`pr-queue@${req.to}`) : null);
  wrap(<InstanceMenu projectId="p1" instance={inst("pr-queue@0.3.0")} title="PR en attente" />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions PR en attente" }));
  const items = await screen.findAllByRole("menuitem");
  expect(items.map((i) => i.textContent)).toEqual([
    "Mettre à jour vers 0.5.0",
    "Mettre à jour vers 0.4.0",
    "Retirer de la page",
  ]);
  await user.click(items[0] as HTMLElement);
  expect(calls.at(-1)).toEqual({ method: "updateInstance", projectId: "p1", instanceId: "i1", to: "0.5.0" });
  expect(await screen.findByText("Instance mise à jour en 0.5.0.")).toBeTruthy();
  answer = async () => {
    throw new KiboError("MIGRATION_FAILED", "x");
  };
  const log = console.error;
  console.error = () => undefined;
  try {
    await user.click(screen.getByRole("button", { name: "Actions PR en attente" }));
    await user.click((await screen.findAllByRole("menuitem"))[0] as HTMLElement);
    expect((await screen.findByRole("alert")).textContent).toBe("Impossible de mettre à jour l'instance.");
  } finally {
    console.error = log;
  }
  answer = async () => null;
  await user.click(screen.getByRole("button", { name: "Actions PR en attente" }));
  await user.click(await screen.findByRole("menuitem", { name: "Retirer de la page" }));
  expect(calls.at(-1)).toEqual({
    method: "command",
    projectId: "p1",
    command: { method: "removeInstance", instanceId: "i1" },
  });
});

test("D1: an update to an unapproved version asks for trust first", async () => {
  components = prQueue(version("0.3.0"), version("0.4.0", { active: false, trust: null }));
  wrap(<InstanceMenu projectId="p1" instance={inst("pr-queue@0.3.0")} title="PR en attente" />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions PR en attente" }));
  await user.click(await screen.findByRole("menuitem", { name: "Mettre à jour vers 0.4.0" }));
  expect(await screen.findByText("Autoriser « PR en attente » 0.4.0 ?")).toBeTruthy();
  expect(calls.some((c) => c.method === "updateInstance")).toBe(false);
});

test("D1: Notes offers its folder, built-ins no update", async () => {
  wrap(<InstanceMenu projectId="p1" instance={inst("notes@1.0.0")} title="Notes" />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions Notes" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Dossier des notes…",
    "Retirer de la page",
  ]);
});

test("D6: the notes folder dialog shows and saves the folder", async () => {
  answer = async (req) => {
    if (req.method === "getNotesDir")
      return {
        dir: "/Users/adam/goinfre/Kibo/notes",
        displayDir: "~/goinfre/Kibo/notes",
        obsidian: true,
        folderRelative: "notes",
      };
    if (req.method === "setNotesDir" && req.dir === "/nope") throw new KiboError("INVALID_INPUT", "missing");
    return { dir: "/vault", displayDir: "/vault", obsidian: true, folderRelative: null };
  };
  const onOpenChange = mock((_: boolean) => {});
  wrap(<NotesDirDialog projectId="p1" open onOpenChange={onOpenChange} />);
  const user = userEvent.setup();
  const field = await screen.findByLabelText("Dossier");
  await waitFor(() => expect((field as HTMLInputElement).value).toBe("/Users/adam/goinfre/Kibo/notes"));
  await user.clear(field);
  await user.type(field, "/nope");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Dossier introuvable ou illisible.");
  await user.clear(field);
  await user.type(field, "/vault");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  expect(calls.at(-1)).toEqual({ method: "setNotesDir", projectId: "p1", dir: "/vault" });
});
