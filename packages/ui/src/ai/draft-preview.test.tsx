import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { type AiEvent, KiboError, type RpcRequest, surfaceFor } from "@kibo/schema";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type BridgeDeps, createFrameBridge } from "../shell/frame-bridge";
import { previewBox } from "./DraftPreviewWindow";
import { DRAFT_ID, burndownManifest as manifest } from "./draft-fixtures";
import { inMemoryWorkers } from "./preview-worker-fixtures";
import { createWorkerBackend } from "./worker-backend";

const sandbox = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: () =>
    new Response("<!doctype html><title>preview</title>", { headers: { "content-type": "text/html" } }),
});
afterAll(() => sandbox.stop(true));
const ORIGIN = `http://127.0.0.1:${sandbox.port}`;
const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);
const calls: RpcRequest[] = [];
const aiListeners = new Set<(e: AiEvent) => void>();
let preview: (n: number) => unknown = () => ({
  hash: HASH,
  path: `/c/drafts/${DRAFT_ID}/${HASH}/index.html`,
});

mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "getRuntimeInfo") return { sandboxOrigin: ORIGIN };
      if (req.method === "previewComponentDraft") {
        const out = preview(calls.filter((c) => c.method === "previewComponentDraft").length);
        if (out instanceof Error) throw out;
        return out;
      }
      throw new KiboError("INTERNAL", `unexpected ${req.method}`);
    },
    subscribeAi: (listener: (e: AiEvent) => void) => {
      aiListeners.add(listener);
      return () => aiListeners.delete(listener);
    },
  },
}));

const { DraftPreviewFrame } = await import("./DraftPreviewFrame");

beforeEach(() => {
  calls.length = 0;
  preview = () => ({ hash: HASH, path: `/c/drafts/${DRAFT_ID}/${HASH}/index.html` });
});

const previewCalls = () => calls.filter((c) => c.method === "previewComponentDraft");
const PATIENT = 60_000;
const DEADLINE = 40;

function mount(
  format: "medium" | "half" = "medium",
  theme: "dark" | "light" = "dark",
  readyTimeoutMs = PATIENT,
) {
  const bridges: BridgeDeps[] = [];
  const createBridge = (deps: BridgeDeps) => {
    bridges.push(deps);
    return createFrameBridge({ ...deps, log: () => {} });
  };
  const workers = inMemoryWorkers();
  const createBackend = (m: typeof manifest) => createWorkerBackend(m, workers.spawn);
  const ui = (f: "medium" | "half", t: "dark" | "light") => (
    <DraftPreviewFrame
      draftId={DRAFT_ID}
      manifest={{ ...manifest }}
      format={f}
      theme={t}
      createBridge={createBridge}
      createBackend={createBackend}
      readyTimeoutMs={readyTimeoutMs}
    />
  );
  const view = render(ui(format, theme));
  return {
    view,
    bridges,
    workers,
    rerender: (f: "medium" | "half", t: "dark" | "light") => view.rerender(ui(f, t)),
  };
}

const frame = () => screen.findByTitle("Aperçu de Burndown") as Promise<HTMLIFrameElement>;

const fromFrame = (iframe: HTMLIFrameElement, data: unknown, source: unknown = iframe.contentWindow) =>
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data, source: source as Window }));
  });

const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

test("screen 133: the sandbox frame loads the draft path and the mock answers, never the daemon", async () => {
  const { view, bridges } = mount();
  const iframe = await frame();
  expect(iframe.getAttribute("src")).toBe(`${ORIGIN}/c/drafts/${DRAFT_ID}/${HASH}/index.html`);
  expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
  expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer");
  await waitFor(() => expect(bridges).toHaveLength(1));
  expect(bridges[0]?.init()).toMatchObject({
    format: "medium",
    theme: "dark",
    surface: surfaceFor(manifest, "medium"),
    config: {},
  });
  expect(previewCalls()).toEqual([{ method: "previewComponentDraft", draftId: DRAFT_ID }]);
  const tickets = await bridges[0]?.call({ kind: "list", entity: "ticket" });
  expect(Array.isArray(tickets) && tickets.length > 0).toBe(true);
  await bridges[0]?.call({
    kind: "run",
    command: { method: "createTicket", title: "Essai", statusId: "todo", parentId: null },
  });
  expect(calls.every((c) => c.method === "getRuntimeInfo" || c.method === "previewComponentDraft")).toBe(
    true,
  );
  view.unmount();
});

test("the bridge answers its own frame and ignores other windows; opening requests go nowhere", async () => {
  const { view } = mount();
  const iframe = await frame();
  const posted: unknown[] = [];
  const win = iframe.contentWindow as Window;
  win.postMessage = (msg: unknown) => {
    posted.push(msg);
  };
  await fromFrame(iframe, { kibo: 1, type: "ready" }, window);
  expect(posted).toEqual([]);
  await fromFrame(iframe, { kibo: 1, type: "ready" });
  expect(posted[0]).toMatchObject({ type: "init", format: "medium", theme: "dark" });
  await fromFrame(iframe, { kibo: 1, type: "call", id: 1, call: { kind: "data.keys" } });
  await fromFrame(iframe, { kibo: 1, type: "openTicket", ticketId: "t1" });
  await fromFrame(iframe, { kibo: 1, type: "openView", componentId: "kanban" });
  const keys: string[] = [];
  const onKey = (e: KeyboardEvent) => keys.push(e.key);
  document.addEventListener("keydown", onKey);
  await fromFrame(iframe, { kibo: 1, type: "key", combo: "escape" });
  document.removeEventListener("keydown", onKey);
  expect(keys).toEqual([]);
  await settle();
  expect(posted[1]).toEqual({ kibo: 1, type: "reply", id: 1, ok: true, result: [] });
  expect(calls.some((c) => c.method !== "getRuntimeInfo" && c.method !== "previewComponentDraft")).toBe(
    false,
  );
  view.unmount();
});

test("a format change remounts the frame at the new size without asking for a new build", async () => {
  const { view, bridges, rerender } = mount("medium");
  const iframe = await frame();
  expect(iframe.style.width).toBe("590px");
  expect(iframe.style.height).toBe("272px");
  rerender("half", "dark");
  await waitFor(() => expect(bridges.at(-1)?.init().format).toBe("half"));
  const next = await frame();
  expect(next.style.width).toBe("1196px");
  expect(next.style.height).toBe("560px");
  expect(previewCalls()).toHaveLength(1);
  view.unmount();
});

test("the frame is scaled down to the available width, keeping its grid width inside", async () => {
  const workers = inMemoryWorkers();
  const view = render(
    <DraftPreviewFrame
      draftId={DRAFT_ID}
      manifest={manifest}
      format="full"
      theme="dark"
      available={598}
      createBridge={(deps) => createFrameBridge({ ...deps, log: () => {} })}
      createBackend={(m) => createWorkerBackend(m, workers.spawn)}
      readyTimeoutMs={PATIENT}
    />,
  );
  const iframe = await frame();
  expect(iframe.style.width).toBe("1196px");
  expect(iframe.style.transform).toBe("scale(0.5)");
  expect(iframe.parentElement?.style.width).toBe("598px");
  expect(iframe.parentElement?.style.height).toBe(`${previewBox("full").height / 2}px`);
  view.unmount();
});

test("the theme follows the application without a new build", async () => {
  const { view, rerender } = mount("medium", "dark");
  const iframe = await frame();
  const posted: unknown[] = [];
  (iframe.contentWindow as Window).postMessage = (msg: unknown) => {
    posted.push(msg);
  };
  rerender("medium", "light");
  await settle();
  expect(posted).toContainEqual({ kibo: 1, type: "theme", theme: "light" });
  expect(previewCalls()).toHaveLength(1);
  view.unmount();
});

test("draft.changed of this draft back in review asks for the build again; another draft or a generation does not", async () => {
  const { view } = mount();
  await frame();
  preview = () => ({ hash: OTHER_HASH, path: `/c/drafts/${DRAFT_ID}/${OTHER_HASH}/index.html` });
  act(() => {
    for (const l of aiListeners)
      l({ type: "draft.changed", draftId: "1b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11", status: "review" });
  });
  act(() => {
    for (const l of aiListeners) l({ type: "draft.changed", draftId: DRAFT_ID, status: "generating" });
  });
  expect(previewCalls()).toHaveLength(1);
  act(() => {
    for (const l of aiListeners) l({ type: "draft.changed", draftId: DRAFT_ID, status: "review" });
  });
  await waitFor(async () => expect((await frame()).getAttribute("src")).toContain(OTHER_HASH));
  expect(previewCalls()).toHaveLength(2);
  view.unmount();
  expect(aiListeners.size).toBe(0);
});

test("each mount asks for the build again: no path is kept between mounts", async () => {
  const first = mount();
  await frame();
  first.view.unmount();
  const second = mount();
  await frame();
  expect(previewCalls()).toHaveLength(2);
  second.view.unmount();
});

test("a frame that never gets ready is rebuilt once, then the preview is unavailable", async () => {
  const errors = console.error;
  console.error = () => {};
  const { view } = mount("medium", "dark", DEADLINE);
  await frame();
  const alert = await screen.findByRole("alert");
  console.error = errors;
  expect(alert.textContent).toContain("Aperçu indisponible.");
  expect(alert.textContent).toContain("Le composant ne s'est pas chargé.");
  expect(screen.queryByTitle("Aperçu de Burndown")).toBeNull();
  expect(previewCalls()).toHaveLength(2);
  view.unmount();
});

test("a frame that reloads after ready stops the preview at once, without a new build", async () => {
  const errors = console.error;
  console.error = () => {};
  const { view } = mount();
  const iframe = await frame();
  await fromFrame(iframe, { kibo: 1, type: "ready" });
  act(() => {
    iframe.dispatchEvent(new Event("load"));
    iframe.dispatchEvent(new Event("load"));
  });
  const alert = await screen.findByRole("alert");
  console.error = errors;
  expect(alert.textContent).toContain("Le composant a rechargé ou quitté son cadre : aperçu arrêté.");
  expect(screen.queryByTitle("Aperçu de Burndown")).toBeNull();
  await settle();
  expect(previewCalls()).toHaveLength(1);
  view.unmount();
});

test("the demo worker is terminated on unmount and on Réessayer", async () => {
  const errors = console.error;
  console.error = () => {};
  const { view, bridges, workers } = mount();
  let iframe = await frame();
  await waitFor(() => expect(bridges).toHaveLength(1));
  await bridges[0]?.call({ kind: "data.keys" });
  expect(workers.spawned()).toBe(1);
  await fromFrame(iframe, { kibo: 1, type: "ready" });
  act(() => {
    iframe.dispatchEvent(new Event("load"));
    iframe.dispatchEvent(new Event("load"));
  });
  await userEvent.setup().click(await screen.findByRole("button", { name: "Réessayer" }));
  console.error = errors;
  expect(workers.terminated()).toBe(workers.spawned());
  iframe = await frame();
  await waitFor(() => expect(bridges).toHaveLength(2));
  await bridges[1]?.call({ kind: "data.keys" });
  expect(workers.spawned()).toBe(2);
  view.unmount();
  expect(workers.terminated()).toBe(workers.spawned());
});

test("reloaded details with the same manifest keep the demo worker and its data", async () => {
  const { view, bridges, workers, rerender } = mount();
  await frame();
  await waitFor(() => expect(bridges).toHaveLength(1));
  await bridges[0]?.call({ kind: "run", command: { method: "createTicket", title: "Gardé" } });
  rerender("medium", "light");
  await settle();
  const tickets = await bridges.at(-1)?.call({ kind: "list", entity: "ticket" });
  expect(JSON.stringify(tickets)).toContain("Gardé");
  expect(workers.spawned()).toBe(1);
  expect(workers.terminated()).toBe(0);
  view.unmount();
});

test("demo data that cannot start makes the preview unavailable", async () => {
  const { view, bridges, workers } = mount();
  await frame();
  await waitFor(() => expect(bridges).toHaveLength(1));
  const errors = console.error;
  console.error = () => {};
  const call = bridges[0]?.call({ kind: "data.keys" }).catch(() => null);
  act(() => workers.crash());
  console.error = errors;
  await call;
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Aperçu indisponible.");
  expect(alert.textContent).toContain("Les données de démonstration n'ont pas pu démarrer.");
  view.unmount();
});

test("a skeleton with role=status is shown while the build runs", async () => {
  let release: (v: unknown) => void = () => {};
  preview = () =>
    new Promise((r) => {
      release = r;
    });
  const { view } = mount();
  expect(await screen.findByRole("status", { name: "Construction de l'aperçu…" })).toBeTruthy();
  await act(async () => release({ hash: HASH, path: `/c/drafts/${DRAFT_ID}/${HASH}/index.html` }));
  expect(await frame()).toBeTruthy();
  view.unmount();
});

const refusals = [
  ["INVALID_INPUT", "Le brouillon n'est plus en relecture."],
  ["CONFLICT", "Le brouillon a changé pendant la construction : réessaie."],
  ["VALIDATION_FAILED", "La construction de l'aperçu a échoué."],
  ["NOT_FOUND", "Brouillon introuvable."],
  ["STORE_CORRUPT", "Le stockage des brouillons est illisible."],
] as const;

for (const [code, text] of refusals) {
  test(`a ${code} refusal is shown with role=alert`, async () => {
    preview = () => new KiboError(code, "refused");
    const { view } = mount();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Aperçu indisponible.");
    expect(alert.textContent).toContain(text);
    expect(screen.queryByTitle("Aperçu de Burndown")).toBeNull();
    view.unmount();
  });
}

test("after a CONFLICT, Réessayer asks for the build again and shows the frame", async () => {
  preview = (n) =>
    n === 1
      ? new KiboError("CONFLICT", "changed")
      : { hash: HASH, path: `/c/drafts/${DRAFT_ID}/${HASH}/index.html` };
  const { view } = mount();
  await screen.findByRole("alert");
  await userEvent.setup().click(screen.getByRole("button", { name: "Réessayer" }));
  expect(await frame()).toBeTruthy();
  expect(previewCalls()).toHaveLength(2);
  view.unmount();
});
