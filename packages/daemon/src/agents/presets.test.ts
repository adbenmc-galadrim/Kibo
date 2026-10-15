import { expect, test } from "bun:test";
import {
  type Agent,
  type AgentSettingsPatch,
  applyPreset,
  DELIVERY_ALLOW_DEFAULTS,
  KiboError,
  presetPatch,
} from "@kibo/schema";
import { LOCAL_CONTEXT, type RpcContext } from "../rpc-extensions";
import { testAgent } from "./agents-port.test-helper";
import { agentPresetRpc, applyAgentPreset } from "./presets";

const HOME = "/Users/a";
const SKILLS = "/Users/a/.claude/skills";

function fakeService(agent: Agent) {
  const patches: AgentSettingsPatch[] = [];
  let current = agent;
  return {
    patches,
    service: {
      read: () => current,
      settings(_ref: string, patch: AgentSettingsPatch) {
        patches.push(patch);
        current = { ...current, settings: applyPreset(current.settings, patch) };
        return current.settings;
      },
    },
  };
}

const fullDelivery = () =>
  testAgent({
    id: "full-delivery",
    permissionMode: "default",
    maxParallel: 3,
    allow: ["Bash(git *)", "Bash(make *)"],
    addDirs: ["/Users/a/Documents/emis"],
  });

test("the delivery preset merges its rules and folders into the agent and keeps the rest", () => {
  const { service, patches } = fakeService(fullDelivery());
  const agent = applyAgentPreset(service, "global:full-delivery", "delivery", HOME);
  const patch = presetPatch("delivery", HOME);
  expect(patches).toEqual([
    {
      ...patch,
      allow: ["Bash(git *)", "Bash(make *)", ...DELIVERY_ALLOW_DEFAULTS.filter((r) => r !== "Bash(git *)")],
      addDirs: ["/Users/a/Documents/emis", SKILLS],
    },
  ]);
  expect(agent.settings).toMatchObject({
    permissionMode: "auto",
    allSubagents: true,
    workspace: "worktree",
    skills: { mode: "all" },
    maxParallel: 3,
  });
});

test("applying the preset twice changes nothing more", () => {
  const { service } = fakeService(fullDelivery());
  const once = applyAgentPreset(service, "global:full-delivery", "delivery", HOME);
  const twice = applyAgentPreset(service, "global:full-delivery", "delivery", HOME);
  expect(twice.settings).toEqual(once.settings);
});

test("a Kibo agent never takes a preset", () => {
  const system = testAgent({ id: "demo", system: true });
  const { service, patches } = fakeService(system);
  expect(() => applyAgentPreset(service, system.ref, "delivery", HOME)).toThrow("INVALID_INPUT");
  expect(patches).toEqual([]);
});

test("a forbidden folder already on the agent stops the preset before any write", () => {
  const { service, patches } = fakeService(testAgent({ addDirs: ["/Users/a/.kibo"] }));
  expect(() => applyAgentPreset(service, "global:opus", "delivery", HOME)).toThrow(/\.kibo/);
  expect(patches).toEqual([]);
});

const REMOTE: RpcContext = { sessionHash: "remote", remote: true };

function rpcRig(agent: Agent) {
  const asserted: string[] = [];
  const fake = fakeService(agent);
  const rpc = agentPresetRpc(fake.service, {
    home: HOME,
    assertWritable(projectId) {
      asserted.push(projectId);
      throw new KiboError("FORBIDDEN", "read only");
    },
  });
  return { ...fake, rpc, asserted };
}

test("the RPC applies the preset for a local session only", async () => {
  const { rpc, patches } = rpcRig(fullDelivery());
  expect(rpc.methods).toEqual(["agents.applyPreset"]);
  const req = { method: "agents.applyPreset", ref: "global:full-delivery", preset: "delivery" } as const;
  await expect(rpc.handle(req, REMOTE)).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(patches).toEqual([]);
  expect(await rpc.handle(req, LOCAL_CONTEXT)).toMatchObject({ settings: { permissionMode: "auto" } });
});

test("a project agent needs write access to its project", async () => {
  const agent = testAgent({ id: "livreur", projectId: "p1" });
  const { rpc, patches, asserted } = rpcRig(agent);
  const req = { method: "agents.applyPreset", ref: agent.ref, preset: "delivery" } as const;
  await expect(rpc.handle(req, LOCAL_CONTEXT)).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(asserted).toEqual(["p1"]);
  expect(patches).toEqual([]);
});
