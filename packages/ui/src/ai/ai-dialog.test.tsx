import { beforeEach, expect, mock, test } from "bun:test";
import {
  type ComponentDraftDetails,
  type ComponentManifest,
  type FileDiff,
  KiboError,
  type PublishPreview,
  type RpcRequest,
} from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let answer: (req: RpcRequest) => unknown = () => null;
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      const out = answer(req);
      if (out instanceof Error) throw out;
      return out;
    },
    subscribeAi: () => () => {},
  },
}));
mock.module("../state/use-agents", () => ({
  useAgents: () => ({ runs: [{ id: "run-7", label: "generateur", profileName: "opus", state: "running" }] }),
  useConfig: () => null,
  useNow: () => 0,
  useRunLog: () => [],
  useDaemonOnline: () => true,
}));
mock.module("../state/use-projects", () => ({ useProjects: () => [], useProject: () => null }));

const { DescribeCard } = await import("./DescribeCard");
const { AiDraftPanel } = await import("./AiDraftPanel");

const ok = {
  available: true,
  reason: null,
  version: "2.1.283",
  loggedIn: true,
  profiles: { assistant: true, generateur: true },
};
const report = {
  ok: false,
  manifest: { ok: true, errors: [] },
  imports: { ok: true, errors: [] },
  typecheck: { ok: false, errors: ["ui.tsx(3,7): error TS2322"] },
  tests: { ok: true, passed: 1, failed: 0, output: "1 pass" },
  conformance: { ok: true, errors: [] },
  permissions: { declared: [], used: [], missing: [], unused: [], errors: [] },
  hash: null,
};
const details = (patch: Partial<ComponentDraftDetails>): ComponentDraftDetails => ({
  id: "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11",
  componentId: "burndown",
  mode: "create",
  title: "Burndown",
  kind: "widget",
  withServer: false,
  baseVersion: null,
  description: "Burndown du sprint : tickets restants par jour.",
  runId: "run-7",
  sessionId: "s1",
  status: "generating",
  attempts: 1,
  failure: null,
  incidents: [],
  createdAt: 1,
  updatedAt: 1,
  report: null,
  diff: [],
  manifest: null,
  publish: null,
  ...patch,
});
const uiDiff: FileDiff = {
  path: "ui.tsx",
  origPath: null,
  binary: false,
  hunkStaging: false,
  additions: 1,
  deletions: 0,
  hunks: [
    {
      header: "@@ -0,0 +1 @@",
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: 1,
      section: "",
      lines: [{ kind: "add", text: "export function Burndown() {}", oldNo: null, newNo: 1, noEol: false }],
    },
  ],
};
const manifest: ComponentManifest = {
  id: "burndown",
  version: "0.1.0",
  kind: "widget",
  title: "Burndown",
  reads: ["ticket"],
  writes: [],
  data: false,
  net: [],
  secrets: [],
  mcp: [],
  configVersion: 0,
  changes: [],
  sdk: 1,
};
const publish: PublishPreview = {
  id: "burndown",
  title: "Burndown",
  from: null,
  to: "0.1.0",
  hash: null,
  status: "new",
  usages: [],
  changes: [],
  newPermissions: ["read:ticket"],
  migration: null,
  validation: { ...report, ok: true, typecheck: { ok: true, errors: [] } },
};

beforeEach(() => {
  calls.length = 0;
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

test("DescribeCard proposes a title and an id, then starts the draft", async () => {
  const onStarted = mock(() => {});
  answer = (req) =>
    req.method === "getAiStatus" ? ok : req.method === "startComponentDraft" ? details({}) : null;
  render(<DescribeCard onStarted={onStarted} />);
  const user = userEvent.setup();
  const button = await screen.findByRole("button", { name: "Générer avec un agent" });
  await user.type(screen.getByLabelText("Ce que doit faire le composant"), "Burndown du sprint : tickets");
  expect(button.hasAttribute("disabled")).toBe(false);
  expect((screen.getByLabelText("Identifiant") as HTMLInputElement).value).toBe("burndown-du-sprint");
  await user.click(button);
  expect(calls.at(-1)).toEqual({
    method: "startComponentDraft",
    draft: {
      mode: "create",
      id: "burndown-du-sprint",
      title: "Burndown du sprint",
      kind: "widget",
      withServer: false,
      description: "Burndown du sprint : tickets",
    },
  });
  expect(onStarted).toHaveBeenCalledTimes(1);
});

test("DescribeCard shows a taken id and a blocked AI", async () => {
  answer = (req) =>
    req.method === "getAiStatus"
      ? ok
      : req.method === "startComponentDraft"
        ? new KiboError("CONFLICT", "taken")
        : null;
  render(<DescribeCard onStarted={() => {}} />);
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText("Ce que doit faire le composant"),
    "Burndown du sprint : tickets",
  );
  await user.click(screen.getByRole("button", { name: "Générer avec un agent" }));
  expect(await screen.findByText("Identifiant déjà pris.")).toBeTruthy();
});

test("DescribeCard is disabled offline", async () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  answer = (req) => (req.method === "getAiStatus" ? ok : null);
  render(<DescribeCard onStarted={() => {}} />);
  expect(await screen.findByText("Hors ligne")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Générer avec un agent" }).hasAttribute("disabled")).toBe(true);
});

test("step 2 shows the attempt and the run journal", async () => {
  answer = () => details({});
  render(<AiDraftPanel draftId="0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11" target={null} onDone={() => {}} />);
  expect(await screen.findByText("Tentative 1 sur 3")).toBeTruthy();
  expect(screen.getByRole("list", { name: "Journal de generateur" })).toBeTruthy();
  expect(screen.getByText("· opus")).toBeTruthy();
});

test("step 3 failure: report, incidents, retry; exhausted: code fallback only", async () => {
  answer = () =>
    details({
      status: "failed",
      failure: { kind: "validation", detail: null },
      report,
      incidents: [{ kind: "restored", path: "kibo.component.json" }],
    });
  const { unmount } = render(
    <AiDraftPanel draftId="0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11" target={null} onDone={() => {}} />,
  );
  expect(await screen.findByText("kibo.component.json restauré (fichier réservé à Kibo)")).toBeTruthy();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Corriger avec l'agent" }));
  expect(calls.find((c) => c.method === "retryComponentDraft")).toEqual({
    method: "retryComponentDraft",
    draftId: "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11",
  });
  unmount();
  answer = () =>
    details({ status: "failed", attempts: 3, failure: { kind: "validation", detail: null }, report });
  render(<AiDraftPanel draftId="0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11" target={null} onDone={() => {}} />);
  expect(
    (await screen.findByRole("button", { name: "Corriger avec l'agent" })).hasAttribute("disabled"),
  ).toBe(true);
  expect(screen.getByRole("button", { name: "Ouvrir le dossier dans l'éditeur" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Revalider" })).toBeTruthy();
});

test("review (create) then permissions then finalize on the current page", async () => {
  let status: "review" | "permissions" = "review";
  answer = (req) => {
    if (req.method === "reviewComponentDraft") status = "permissions";
    if (req.method === "finalizeComponentDraft")
      return { publish: {}, version: { version: "0.1.0" }, instanceId: "i1" };
    return details({
      status,
      diff: [uiDiff],
      manifest,
      publish: { ...publish, hash: status === "permissions" ? "3f9a".padEnd(64, "0") : null },
    });
  };
  const onDone = mock(() => {});
  render(
    <AiDraftPanel
      draftId="0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11"
      target={{ projectId: "p1", pageId: "pg1" }}
      onDone={onDone}
    />,
  );
  const user = userEvent.setup();
  expect(await screen.findByText("export function Burndown() {}")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "J'ai relu, continuer" }));
  expect(calls.find((c) => c.method === "reviewComponentDraft")).toEqual({
    method: "reviewComponentDraft",
    draftId: "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11",
    version: "0.1.0",
    changes: [],
  });
  expect(await screen.findByText(/3f9a…0000/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Autoriser et ajouter" }));
  expect(calls.find((c) => c.method === "finalizeComponentDraft")).toEqual({
    method: "finalizeComponentDraft",
    draftId: "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11",
    version: "0.1.0",
    hash: "3f9a".padEnd(64, "0"),
    trust: "sandboxed",
    strategy: "update-all",
    target: { projectId: "p1", pageId: "pg1" },
  });
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
});

test("review (modify) goes through the publish step with an editable version", async () => {
  answer = () =>
    details({
      mode: "modify",
      baseVersion: "0.1.0",
      status: "review",
      diff: [uiDiff],
      manifest,
      publish: { ...publish, from: "0.1.0", to: "0.2.0", status: "update", changes: ["Ajoute un titre"] },
    });
  render(<AiDraftPanel draftId="0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11" target={null} onDone={() => {}} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "J'ai relu, continuer" }));
  const version = await screen.findByLabelText("Version");
  await user.clear(version);
  await user.type(version, "0.1.1");
  await user.click(screen.getByRole("button", { name: "Publier" }));
  expect(calls.find((c) => c.method === "reviewComponentDraft")).toEqual({
    method: "reviewComponentDraft",
    draftId: "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11",
    version: "0.1.1",
    changes: ["Ajoute un titre"],
  });
});
