import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import {
  type Capability,
  ComponentManifest,
  type Instance,
  type Page,
  type ProjectSnapshot,
  type RpcRequest,
} from "@kibo/schema";
import { type ComponentModule, type KiboSdk, useSdk } from "@kibo/sdk";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { apiMock } from "../api-mock";
import { kiboProject } from "../lib/fixtures";

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
const { PageView } = await import("./PageView");
const { HostProvider } = await import("../shell/Host");
const { PageActionsProvider } = await import("../shell/page-actions");

const sdks = new Map<string, KiboSdk>();
let mounts = 0;
function probe(id: string) {
  return function Probe() {
    const sdk = useSdk();
    sdks.set(id, sdk);
    useEffect(() => {
      mounts += 1;
    }, []);
    return <p>{`${id} content`}</p>;
  };
}
const module = (id: string, title: string, capabilities: Capability[]): ComponentModule => ({
  manifest: ComponentManifest.parse({
    id,
    version: "1.0.0",
    kind: "widget",
    title,
    reads: [],
    writes: [],
    capabilities,
  }),
  Component: probe(id),
});
const probes = [module("arcade", "Arcade", ["fullscreen"]), module("plain", "Plain", [])];
BUILTIN_COMPONENTS.push(...probes);
afterAll(() => {
  for (const p of probes) BUILTIN_COMPONENTS.splice(BUILTIN_COMPONENTS.indexOf(p), 1);
});

const host = {
  openTicket: () => undefined,
  openNewTicket: () => undefined,
  openFile: () => undefined,
  openView: () => undefined,
  openTarget: () => undefined,
};
const page: Page = { id: "pg", title: "Jeux", kind: "dashboard", parentId: null };
const widget = (id: string, component: string, x: number): Instance => ({
  id,
  pageId: "pg",
  component,
  layout: { x, y: 0, w: 4, h: 4 },
  config: {},
  componentHash: null,
});
const project = (): ProjectSnapshot => ({
  ...kiboProject(),
  pages: [page],
  instances: [widget("i1", "arcade@1.0.0", 0), widget("i2", "plain@1.0.0", 4)],
});
const page_ = (snapshot: ProjectSnapshot) => (
  <HostProvider host={host}>
    <PageActionsProvider>
      <PageView project={snapshot} page={page} viewer="adam" />
    </PageActionsProvider>
  </HostProvider>
);
const show = () => render(page_(project()));
const cardOf = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-instance="${id}"] > div`);
const pressEscape = () => act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));

beforeEach(() => {
  calls.length = 0;
  mounts = 0;
  sdks.clear();
  document.body.style.overflow = "";
});

test("only a widget that declares fullscreen offers the button", async () => {
  const view = show();
  await screen.findByText("arcade content");
  await screen.findByText("plain content");
  expect(await screen.findAllByRole("button", { name: "Plein écran" })).toHaveLength(1);
  expect(cardOf(view.container, "i1")?.querySelector('[aria-label="Plein écran"]')).toBeTruthy();
  view.unmount();
});

test("Échap right after entering leaves, before the bar has loaded, and gives the focus back", async () => {
  const view = show();
  await screen.findByText("arcade content");
  const button = await screen.findByRole("button", { name: "Plein écran" });
  act(() => button.click());
  expect(screen.getByRole("dialog", { name: "Arcade" })).toBeTruthy();
  pressEscape();
  expect(screen.queryByRole("dialog")).toBeNull();
  await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Plein écran"));
  expect(document.body.style.overflow).toBe("");
  view.unmount();
});

test("the focused card fills the window in the same node, Échap leaves unless a dialog is open", async () => {
  const view = show();
  await screen.findByText("arcade content");
  const card = cardOf(view.container, "i1");
  const before = mounts;
  await userEvent.setup().click(await screen.findByRole("button", { name: "Plein écran" }));
  const dialog = screen.getByRole("dialog", { name: "Arcade" });
  expect(dialog).toBe(card);
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(dialog.className).toContain("fixed inset-0 z-50");
  expect(mounts).toBe(before);
  expect(sdks.get("arcade")?.focus.active()).toBe(true);
  expect(view.container.querySelector(".isolate")).toBeNull();
  await waitFor(() => expect(document.body.style.overflow).toBe("hidden"));
  await waitFor(() => expect(document.activeElement?.textContent).toBe("Quitter le plein écran (Échap)"));
  document.body.insertAdjacentHTML("beforeend", '<div id="other" role="dialog" data-state="open"></div>');
  pressEscape();
  expect(screen.getByRole("dialog", { name: "Arcade" })).toBe(card);
  document.getElementById("other")?.remove();
  pressEscape();
  expect(screen.queryByRole("dialog", { name: "Arcade" })).toBeNull();
  expect(sdks.get("arcade")?.focus.active()).toBe(false);
  expect(document.body.style.overflow).toBe("");
  expect(view.container.querySelector(".isolate")).toBeTruthy();
  expect(mounts).toBe(before);
  view.unmount();
});

test("the component itself enters and leaves, the bar's button leaves too", async () => {
  const view = show();
  await screen.findByText("arcade content");
  act(() => sdks.get("arcade")?.focus.request());
  expect(screen.getByRole("dialog", { name: "Arcade" })).toBeTruthy();
  act(() => sdks.get("arcade")?.focus.exit());
  expect(screen.queryByRole("dialog")).toBeNull();
  act(() => sdks.get("arcade")?.focus.request());
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: "Quitter le plein écran (Échap)" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  view.unmount();
});

test("a focus request without the capability changes nothing and is reported", async () => {
  const view = show();
  await screen.findByText("plain content");
  await act(async () => {
    sdks.get("plain")?.focus.request();
    await Promise.resolve();
  });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(sdks.get("plain")?.focus.active()).toBe(false);
  expect(calls.filter((c) => c.method === "reportComponentRefusal")).toEqual([
    { method: "reportComponentRefusal", projectId: kiboProject().meta.id, instanceId: "i2", kind: "focus" },
  ]);
  view.unmount();
});

test("every widget follows the visibility of the tab", async () => {
  const view = show();
  await screen.findByText("arcade content");
  await screen.findByText("plain content");
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  try {
    await waitFor(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      expect(sdks.get("arcade")?.visibility.visible()).toBe(false);
      expect(sdks.get("plain")?.visibility.visible()).toBe(false);
    });
  } finally {
    Reflect.deleteProperty(document, "visibilityState");
    view.unmount();
  }
});

test("leaving the fullscreen gives the focus back to its button", async () => {
  const view = show();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Plein écran" }));
  await user.click(await screen.findByRole("button", { name: "Quitter le plein écran (Échap)" }));
  await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Plein écran"));
  view.unmount();
});

test("a widget removed while in fullscreen does not come back in fullscreen", async () => {
  const view = show();
  await screen.findByText("arcade content");
  act(() => sdks.get("arcade")?.focus.request());
  expect(screen.getByRole("dialog", { name: "Arcade" })).toBeTruthy();
  const without = { ...project(), instances: project().instances.filter((i) => i.id !== "i1") };
  view.rerender(page_(without));
  await waitFor(() => expect(screen.queryByText("arcade content")).toBeNull());
  view.rerender(page_(project()));
  await screen.findByText("arcade content");
  expect(screen.queryByRole("dialog")).toBeNull();
  view.unmount();
});
