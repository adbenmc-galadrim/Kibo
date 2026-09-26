import { beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest, Topic } from "@kibo/schema";
import { act, render } from "@testing-library/react";
import { agentsFixture, configFixture } from "../agents/fixtures";

const calls: string[] = [];
const topics = new Map<Topic, Set<() => void>>();

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req.method);
      if (req.method === "getAgents") return Promise.resolve(agentsFixture());
      if (req.method === "getConfig") return Promise.resolve(configFixture());
      return Promise.resolve([]);
    },
    subscribeTopic: (topic: Topic, listener: () => void) => {
      const set = topics.get(topic) ?? new Set<() => void>();
      set.add(listener);
      topics.set(topic, set);
      return () => set.delete(listener);
    },
  },
}));

const unmockedModule = "./use-agents?unmocked";
const { useAgents, useConfig, useRunLog }: typeof import("./use-agents") = await import(unmockedModule);

beforeEach(() => {
  calls.length = 0;
  topics.clear();
});

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

function Probe({ runId }: { runId: string | null }) {
  const agents = useAgents();
  const config = useConfig();
  const log = useRunLog(runId);
  return <p>{`${agents?.runs.length ?? "-"} ${config?.profiles.length ?? "-"} ${log?.length ?? "-"}`}</p>;
}

test("agent state, config and run log load, then reload on their topic", async () => {
  const view = render(<Probe runId="r41" />);
  await flush();
  expect(view.container.textContent).toBe("9 3 0");
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
