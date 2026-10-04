import { beforeEach, expect, mock, test } from "bun:test";
import {
  type ComponentSummary,
  type Instance,
  KiboError,
  type RpcRequest,
  type Selection,
} from "@kibo/schema";
import {
  ALWAYS_VISIBLE,
  createSignal,
  focusApi,
  type KiboSdk,
  NO_FOCUS,
  NO_SELECTION,
  selectionApi,
  useSdk,
  visibilityApi,
} from "@kibo/sdk";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { InstanceApis } from "../lib/instance-capabilities";

const H = "c".repeat(64);
const LOCAL = { shared: false, keyAllocator: "local", role: null, access: "write", members: [] };
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
      if (req.method === "listComponentDrafts") return Promise.resolve([]);
      if (req.method === "getRuntimeInfo") return runtime();
      if (req.method === "componentCall" && req.call.kind === "presence.list") return Promise.resolve([]);
      if (req.method === "componentCall" && req.call.kind === "sharing.get") return Promise.resolve(LOCAL);
      return answer(req);
    },
    subscribe: () => () => undefined,
    subscribeTopic: () => () => undefined,
    subscribeEvents: () => () => undefined,
  },
}));

const { loadTrusted } = await import("../shell/trusted-loader");
const { InstanceFrame } = await import("./InstanceFrame");
const { InstanceMenu } = await import("./InstanceMenu");
const { NotesDirDialog } = await import("../dialogs/NotesDirDialog");
const { HostProvider } = await import("../shell/Host");
const APIS: InstanceApis = {
  capabilities: [],
  focus: NO_FOCUS,
  visibility: ALWAYS_VISIBLE,
  selection: NO_SELECTION,
};

await loadTrusted("mine", "1.0.0", H, async () => ({
  manifest: { id: "mine", version: "1.0.0", kind: "widget", title: "Mine", reads: [], writes: [] },
  Component: () => <p>trusted content</p>,
}));

const seenSdks: KiboSdk[] = [];
function Probe() {
  seenSdks.push(useSdk());
  return <p>probe</p>;
}
await loadTrusted("probe", "1.0.0", H, async () => ({
  manifest: { id: "probe", version: "1.0.0", kind: "view", title: "Probe", reads: [], writes: [] },
  Component: Probe,
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
  componentHash: null,
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
    secrets: [],
    mcp: [],
    capabilities: [],
    selection: false,
    configVersion: 0,
    changes: [],
    sdk: 1,
  },
  usages: [],
  revoked: null,
  backend: false,
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
    wrap(
      <InstanceFrame
        apis={APIS}
        projectId="p1"
        instance={inst("pr-queue@0.3.0")}
        viewer="adam"
        surface="widget"
        format="large"
      />,
    );
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
    wrap(
      <InstanceFrame
        apis={APIS}
        projectId="p1"
        instance={inst("pr-queue@0.3.0")}
        viewer="adam"
        surface="widget"
        format="large"
      />,
    );
    const frame = await screen.findByTitle("PR en attente");
    expect(frame.getAttribute("src")).toBe(`http://127.0.0.1:4318/c/pr-queue/0.3.0/${H}/index.html`);
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    await waitFor(() => expect(String(errors[0])).toContain("Iframe page loading is disabled"));
  } finally {
    console.error = log;
    Reflect.set(Object(settings), "disableIframePageLoading", loading);
  }
});

test("D37: seen from a remote browser, a sandboxed widget says it only loads on the host", async () => {
  components = prQueue(version("0.3.0"));
  const happy = Reflect.get(window, "happyDOM");
  const before = location.href;
  Reflect.apply(Reflect.get(Object(happy), "setURL"), happy, ["https://192.168.1.20:47832/"]);
  try {
    wrap(
      <InstanceFrame
        apis={APIS}
        projectId="p1"
        instance={inst("pr-queue@0.3.0")}
        viewer="adam"
        surface="widget"
        format="large"
      />,
    );
    expect((await screen.findByRole("status")).textContent).toBe(
      "Composant sandboxé indisponible à distance : ouvre Kibo sur l'appareil qui l'héberge (127.0.0.1).",
    );
    expect(screen.queryByTitle("PR en attente")).toBeNull();
  } finally {
    Reflect.apply(Reflect.get(Object(happy), "setURL"), happy, [before]);
  }
});

test("a trusted version is loaded as a module", async () => {
  components = [
    { id: "mine", title: "Mine", builtin: false, versions: [version("1.0.0", { trust: "trusted" })] },
  ];
  wrap(
    <InstanceFrame
      apis={APIS}
      projectId="p1"
      instance={inst("mine@1.0.0")}
      viewer="adam"
      surface="widget"
      format="large"
    />,
  );
  expect(await screen.findByText("trusted content")).toBeTruthy();
});

test("the sdk keeps its identity when the project snapshot changes but the instance config does not", async () => {
  components = [
    { id: "probe", title: "Probe", builtin: false, versions: [version("1.0.0", { trust: "trusted" })] },
  ];
  const frame = (config: Record<string, unknown>) => (
    <HostProvider host={host}>
      <InstanceFrame
        apis={APIS}
        projectId="p1"
        instance={{ ...inst("probe@1.0.0"), config }}
        viewer="adam"
        surface="view"
        format="full"
      />
    </HostProvider>
  );
  const { rerender } = render(frame({ folder: "notes" }));
  await screen.findByText("probe");
  rerender(frame({ folder: "notes" }));
  rerender(frame({ folder: "notes" }));
  expect(new Set(seenSdks).size).toBe(1);
  rerender(frame({ folder: "docs" }));
  expect(new Set(seenSdks).size).toBe(2);
  expect(seenSdks.at(-1)?.config).toEqual({ folder: "docs" });
});

test("a component loaded in the app receives the focus, visibility and selection of its instance", async () => {
  components = [
    { id: "probe", title: "Probe", builtin: false, versions: [version("1.0.0", { trust: "trusted" })] },
  ];
  const apis: InstanceApis = {
    capabilities: ["fullscreen"],
    focus: focusApi(createSignal(true), () => undefined),
    visibility: visibilityApi(createSignal(false)),
    selection: selectionApi(createSignal<Selection | null>({ kind: "ticket", ids: ["t1"] })),
  };
  wrap(
    <InstanceFrame
      apis={apis}
      projectId="p1"
      instance={inst("probe@1.0.0")}
      viewer="adam"
      surface="view"
      format="full"
    />,
  );
  await screen.findByText("probe");
  const sdk = seenSdks.at(-1);
  expect(sdk?.focus).toBe(apis.focus);
  expect(sdk?.visibility.visible()).toBe(false);
  expect(sdk?.selection.get()).toEqual({ kind: "ticket", ids: ["t1"] });
});

test("the component reads the format given by the page, not one guessed from its layout", async () => {
  components = [
    { id: "probe", title: "Probe", builtin: false, versions: [version("1.0.0", { trust: "trusted" })] },
  ];
  wrap(
    <InstanceFrame
      apis={APIS}
      projectId="p1"
      instance={inst("probe@1.0.0")}
      viewer="adam"
      surface="widget"
      format="small"
    />,
  );
  await screen.findByText("probe");
  expect(seenSdks.at(-1)?.format).toBe("small");
});

test("D2: an unapproved or tampered version asks for trust", async () => {
  components = prQueue(version("0.3.0", { active: false, trust: null }));
  const { unmount } = wrap(
    <InstanceFrame
      apis={APIS}
      projectId="p1"
      instance={inst("pr-queue@0.3.0")}
      viewer="adam"
      surface="view"
      format="full"
    />,
  );
  expect((await screen.findByText("Autorisation requise")).closest("[data-tampered]")).toBeNull();
  expect(screen.getByText("« PR en attente » 0.3.0 doit être autorisé avant de s'afficher.")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Examiner et autoriser" }));
  expect(await screen.findByText("Autoriser « PR en attente » 0.3.0 ?")).toBeTruthy();
  unmount();
  components = prQueue(version("0.3.0", { active: false, trust: null, tampered: true }));
  wrap(
    <InstanceFrame
      apis={APIS}
      projectId="p1"
      instance={inst("pr-queue@0.3.0")}
      viewer="adam"
      surface="widget"
      format="large"
    />,
  );
  const changed = await screen.findByText("Son code a changé depuis ton accord.");
  expect(changed.closest("[data-tampered]")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Examiner et autoriser" }).hasAttribute("disabled")).toBe(true);
});

test("a built-in is rendered from the UI bundle, an unknown ref says so", async () => {
  const { unmount } = wrap(
    <InstanceFrame
      apis={APIS}
      projectId="p1"
      instance={inst("kanban@1.0.0")}
      viewer="adam"
      surface="widget"
      format="large"
    />,
  );
  await waitFor(() => expect(calls.some((c) => c.method === "getProject")).toBe(true));
  unmount();
  wrap(
    <InstanceFrame
      apis={APIS}
      projectId="p1"
      instance={inst("ghost@9.9.9")}
      viewer="adam"
      surface="widget"
      format="large"
    />,
  );
  expect(await screen.findByText(/ghost@9\.9\.9/)).toBeTruthy();
});

test("S7: a revoked instance offers the other installed versions that are not revoked", async () => {
  const gone = { reason: "faille", at: 1 };
  components = prQueue(
    version("0.3.0", { active: false, trust: null, revoked: gone }),
    version("0.2.0"),
    version("0.4.0", { revoked: gone }),
  );
  wrap(
    <InstanceFrame
      apis={APIS}
      projectId="p1"
      instance={inst("pr-queue@0.3.0")}
      viewer="adam"
      surface="widget"
      format="large"
    />,
  );
  await userEvent.setup().click(await screen.findByRole("button", { name: "Choisir une autre version" }));
  expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Passer en 0.2.0"]);
});

test("S7: a third-party version absent from the registry is reported as missing", async () => {
  wrap(
    <InstanceFrame
      apis={APIS}
      projectId="p1"
      instance={inst("ghost-widget@9.9.9")}
      viewer="adam"
      surface="widget"
      format="large"
    />,
  );
  expect(await screen.findByText("Composant absent : ghost-widget@9.9.9")).toBeTruthy();
  await waitFor(() =>
    expect(calls).toContainEqual({
      method: "findMarketSource",
      id: "ghost-widget",
      version: "9.9.9",
      hash: null,
    }),
  );
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
    "Modifier avec l'IA",
    "Retirer de la page…",
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
  await user.click(await screen.findByRole("menuitem", { name: "Retirer de la page…" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Retirer PR en attente de la page ?" });
  expect(confirm.textContent).toContain("Le widget disparaît de la page ; les tickets ne sont pas touchés.");
  await user.click(within(confirm).getByRole("button", { name: "Retirer" }));
  await waitFor(() =>
    expect(calls.at(-1)).toEqual({
      method: "command",
      projectId: "p1",
      command: { method: "removeInstance", instanceId: "i1" },
    }),
  );
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
    "Réglages…",
    "Retirer de la page…",
  ]);
});

test("the instance menu content is loaded when the menu opens", async () => {
  const user = userEvent.setup();
  wrap(<InstanceMenu projectId="p1" instance={inst("kanban@1.0.0")} title="Kanban" />);
  expect(screen.queryByRole("menu")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Actions Kanban" }));
  expect(await screen.findByRole("menuitem", { name: "Retirer de la page…" })).toBeTruthy();
});

test("a widget with a config schema offers its settings", async () => {
  wrap(<InstanceMenu projectId="p1" instance={inst("kanban@1.0.0")} title="Kanban" />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions Kanban" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Réglages…",
    "Retirer de la page…",
  ]);
  await user.click(screen.getByRole("menuitem", { name: "Réglages…" }));
  expect(await screen.findByRole("dialog", { name: "Réglages · Kanban" })).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Filtre" }).textContent).toBe("Moi + agents");
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

test("modify with AI: offered on an ai instance, not on a marketplace one", async () => {
  components = [
    { id: "burndown", title: "Burndown", builtin: false, versions: [version("0.1.0")] },
    {
      id: "gh-stats",
      title: "GH Stats",
      builtin: false,
      versions: [version("1.0.0", { origin: "marketplace" })],
    },
  ];
  wrap(
    <>
      <InstanceMenu projectId="p1" instance={inst("burndown@0.1.0")} title="Burndown" />
      <InstanceMenu projectId="p1" instance={inst("gh-stats@1.0.0")} title="GH Stats" />
    </>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions GH Stats" }));
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual(["Retirer de la page…"]);
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Actions Burndown" }));
  await user.click(await screen.findByRole("menuitem", { name: "Modifier avec l'IA" }));
  expect(await screen.findByRole("dialog", { name: "Modifier « Burndown » avec l'IA" })).toBeTruthy();
  expect(screen.getByText("Version actuelle 0.1.0 · Créé par l'IA")).toBeTruthy();
});
