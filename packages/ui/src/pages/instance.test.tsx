import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { ComponentManifest, type Instance, type RpcRequest, type Selection } from "@kibo/schema";
import {
  ALWAYS_VISIBLE,
  type ComponentModule,
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
import { apiMock } from "../api-mock";
import type { InstanceApis } from "../lib/instance-capabilities";

const calls: RpcRequest[] = [];

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return Promise.resolve(null);
      },
      subscribe: () => () => undefined,
      subscribeTopic: () => () => undefined,
      subscribeEvents: () => () => undefined,
    },
  }),
);

const { BUILTIN_COMPONENTS } = await import("../registry");
const { InstanceFrame } = await import("./InstanceFrame");
const { InstanceMenu } = await import("./InstanceMenu");
const { HostProvider } = await import("../shell/Host");
const APIS: InstanceApis = {
  capabilities: [],
  focus: NO_FOCUS,
  visibility: ALWAYS_VISIBLE,
  selection: NO_SELECTION,
};

const seenSdks: KiboSdk[] = [];
function Probe() {
  seenSdks.push(useSdk());
  return <p>probe</p>;
}
const probe: ComponentModule = {
  manifest: ComponentManifest.parse({
    id: "probe",
    version: "1.0.0",
    kind: "view",
    title: "Probe",
    reads: [],
    writes: [],
  }),
  Component: Probe,
};
BUILTIN_COMPONENTS.push(probe);
afterAll(() => {
  BUILTIN_COMPONENTS.splice(BUILTIN_COMPONENTS.indexOf(probe), 1);
});

const host = {
  openTicket: () => undefined,
  openNewTicket: () => undefined,
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

beforeEach(() => {
  calls.length = 0;
});

test("the sdk keeps its identity when the project snapshot changes but the instance config does not", async () => {
  const frame = (config: Record<string, unknown>) => (
    <HostProvider host={host}>
      <InstanceFrame
        apis={APIS}
        projectId="p1"
        instance={{ ...inst("probe@1.0.0"), config }}
        viewer="adam"
        surface="view"
        format="full"
        editable
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
      editable
    />,
  );
  await screen.findByText("probe");
  const sdk = seenSdks.at(-1);
  expect(sdk?.focus).toBe(apis.focus);
  expect(sdk?.visibility.visible()).toBe(false);
  expect(sdk?.selection.get()).toEqual({ kind: "ticket", ids: ["t1"] });
});

test("the component reads the format given by the page, not one guessed from its layout", async () => {
  wrap(
    <InstanceFrame
      apis={APIS}
      projectId="p1"
      instance={inst("probe@1.0.0")}
      viewer="adam"
      surface="widget"
      format="small"
      editable
    />,
  );
  await screen.findByText("probe");
  expect(seenSdks.at(-1)?.format).toBe("small");
});

test("the instance menu removes a widget from the page after confirmation", async () => {
  wrap(<InstanceMenu projectId="p1" instance={inst("graph@1.0.0")} title="Graphe" />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions Graphe" }));
  await user.click(await screen.findByRole("menuitem", { name: "Retirer de la page…" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Retirer Graphe de la page ?" });
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
  expect(screen.getByRole("combobox", { name: "Filtre" }).textContent).toBe("Tous");
});
