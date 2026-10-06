import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest, type Topic } from "@kibo/schema";
import { act, render } from "@testing-library/react";
import { agentsFixture, configFixture } from "../agents/fixtures";

const calls: string[] = [];
const topics = new Map<Topic, Set<() => void>>();
const status = { online: false, listeners: new Set<() => void>() };
let runLog: () => Promise<unknown> = () => Promise.resolve([]);

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req.method);
      if (req.method === "getAgents") return Promise.resolve(agentsFixture());
      if (req.method === "getConfig") return Promise.resolve(configFixture());
      return runLog();
    },
    subscribeTopic: (topic: Topic, listener: () => void) => {
      const set = topics.get(topic) ?? new Set<() => void>();
      set.add(listener);
      topics.set(topic, set);
      return () => set.delete(listener);
    },
    online: () => status.online,
    onConnection: (listener: () => void) => {
      status.listeners.add(listener);
      return () => status.listeners.delete(listener);
    },
  },
}));

const unmockedModule = "./use-agents?unmocked";
const { useAgents, useConfig, useDaemonOnline, useRunLog }: typeof import("./use-agents") = await import(
  unmockedModule
);

beforeEach(() => {
  calls.length = 0;
  topics.clear();
  runLog = () => Promise.resolve([]);
});

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

function Probe({ runId }: { runId: string | null }) {
  const agents = useAgents();
  const config = useConfig();
  const { log, missing, empty } = useRunLog(runId);
  const journal = `${log?.length ?? "-"}${missing ? " missing" : ""}${empty ? " empty" : ""}`;
  return <p>{`${agents?.runs.length ?? "-"} ${config?.profiles.length ?? "-"} ${journal}`}</p>;
}

test("agent state, config and run log load, then reload on their topic", async () => {
  const view = render(<Probe runId="r41" />);
  await flush();
  expect(view.container.textContent).toBe("11 3 0 empty");
  expect(calls.sort()).toEqual(["getAgents", "getConfig", "getRunLog"]);
  calls.length = 0;
  await act(async () => {
    for (const listener of topics.get("agents") ?? []) listener();
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(calls.sort()).toEqual(["getAgents", "getRunLog"]);
  view.unmount();
  expect([...topics.values()].every((set) => set.size === 0)).toBe(true);
});

test("no run selected means no log request", async () => {
  render(<Probe runId={null} />);
  await flush();
  expect(calls).not.toContain("getRunLog");
});

test("a run log the daemon no longer has is reported missing, not thrown", async () => {
  runLog = () => Promise.reject(new KiboError("NOT_FOUND", "run r41"));
  const view = render(<Probe runId="r41" />);
  await flush();
  expect(view.container.textContent).toBe("11 3 - missing");
});

test("a run log with entries is not missing", async () => {
  runLog = () => Promise.resolve([{ id: 1, at: 0, event: { type: "cancelled" } }]);
  const view = render(<Probe runId="r41" />);
  await flush();
  expect(view.container.textContent).toBe("11 3 1");
});

function Online() {
  return <p>{useDaemonOnline() ? "on" : "off"}</p>;
}

test("the daemon status follows the client connection", async () => {
  const view = render(<Online />);
  expect(view.container.textContent).toBe("off");
  await act(async () => {
    status.online = true;
    for (const listener of status.listeners) listener();
  });
  expect(view.container.textContent).toBe("on");
  view.unmount();
  expect(status.listeners.size).toBe(0);
});
