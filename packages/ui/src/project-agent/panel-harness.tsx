import { mock } from "bun:test";
import type { RpcRequest, RunLogEntry, SignalsView } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import type { ComponentType } from "react";
import { apiMock } from "../api-mock";
import { type Host, HostProvider } from "../shell/Host";
import { CONVERSATION_LOG, emptyView, pendingBatch, projectRun, siloProject, viewFixture } from "./fixtures";
import { signalsView } from "./signals/fixtures";

type PanelProps = { open: boolean; project: ReturnType<typeof siloProject>; onClose(): void };

export const harness = {
  calls: [] as RpcRequest[],
  opened: [] as string[],
  current: viewFixture(),
  past: viewFixture(),
  log: CONVERSATION_LOG as RunLogEntry[],
  signals: signalsView() as SignalsView,
  send: null as ((req: RpcRequest) => Promise<unknown>) | null,
  listeners: new Set<() => void>(),
};

const answer = (req: RpcRequest): Promise<unknown> => {
  if (req.method === "getProjectAgent") return Promise.resolve(req.runId ? harness.past : harness.current);
  if (req.method === "getRunLog") return Promise.resolve(harness.log);
  if (req.method === "listSignals") return Promise.resolve(harness.signals);
  if (req.method === "decideBatch") return Promise.resolve(pendingBatch({ status: "rejected" }));
  if (req.method === "resetProjectAgent") return Promise.resolve(emptyView());
  if (req.method === "agents.list") return Promise.resolve({ agents: [], notices: [], partialWatch: false });
  if (req.method === "skills.suggest") return Promise.resolve({ skills: [] });
  if (req.method === "sendProjectAgentMessage" && harness.send) return harness.send(req);
  return Promise.resolve(projectRun({ state: "queued" }));
};

export function mockPanelApi(): void {
  mock.module("../api", () =>
    apiMock({
      client: {
        rpc: (req: RpcRequest) => {
          harness.calls.push(req);
          return answer(req);
        },
        subscribeTopic: (_topic: string, listener: () => void) => {
          harness.listeners.add(listener);
          return () => harness.listeners.delete(listener);
        },
      },
    }),
  );
}

export function resetHarness(): void {
  localStorage.clear();
  harness.calls.length = 0;
  harness.opened.length = 0;
  harness.current = viewFixture();
  harness.past = viewFixture({
    session: viewFixture().past[0] ?? null,
    run: projectRun({ id: "pa0", state: "done" }),
    batches: [pendingBatch({ id: "b-old", status: "abandoned", runId: "pa0" })],
    past: [],
  });
  harness.log = CONVERSATION_LOG;
  harness.signals = signalsView();
  harness.send = null;
}

export function emitTopic(): void {
  for (const listener of harness.listeners) listener();
}

const host: Host = {
  openTicket: (id) => harness.opened.push(id),
  openNewTicket: () => {},
  openAssign: () => {},
  openFile: () => {},
  openView: () => {},
  openTarget: () => {},
};

export function showPanel(Panel: ComponentType<PanelProps>): void {
  render(
    <HostProvider host={host}>
      <Panel open project={siloProject()} onClose={() => {}} />
    </HostProvider>,
  );
}

export const panel = () => within(screen.getByRole("dialog"));
export const rpcs = (method: string) => harness.calls.filter((c) => c.method === method);
