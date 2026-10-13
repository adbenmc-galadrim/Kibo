import { expect, test } from "bun:test";
import { join } from "node:path";
import { AGENT_RPC, type AgentPreview, KiboError } from "@kibo/schema";
import { LOCAL_CONTEXT, type RpcContext } from "../rpc-extensions";
import { type AgentPreviewRequest, agentFilesRpc } from "./rpc";
import { DESCRIPTION, makeService } from "./service.test-helper";
import { agentText, PROJECT_ID } from "./test-home.test-helper";

const REMOTE: RpcContext = { sessionHash: "remote", remote: true };

const PREVIEW: AgentPreview = {
  levels: [],
  systemPrompt: "",
  brief: "",
  agentsJson: "{}",
  command: {
    model: "sonnet",
    permissionMode: "default",
    tools: null,
    disallowedTools: null,
    allow: [],
    subagents: [],
    allSubagents: false,
    skills: { mode: "all" },
  },
};

function rig(writable = true) {
  const s = makeService();
  const asserted: string[] = [];
  const previews: AgentPreviewRequest[] = [];
  const rpc = agentFilesRpc(
    s.service,
    async (req) => {
      previews.push(req);
      return PREVIEW;
    },
    {
      viewer: () => "adam",
      assertWritable(projectId) {
        asserted.push(projectId);
        if (!writable) throw new KiboError("PERMISSION_DENIED", "read only");
      },
    },
  );
  return { ...s, rpc, asserted, previews };
}

const create = {
  method: "agents.create",
  scope: "global",
  name: "review-pr",
  description: DESCRIPTION,
  template: "blank",
} as const;

test("the extension serves every agent method", () => {
  expect([...rig().rpc.methods]).toEqual(AGENT_RPC.map((s) => s.shape.method.value));
});

test("a remote session cannot write but can list", async () => {
  const { h, rpc, globalDir } = rig();
  await expect(rpc.handle(create, REMOTE)).rejects.toMatchObject({ code: "FORBIDDEN" });
  h.write(join(globalDir, "livraison.md"), agentText("livraison"));
  const listed = await rpc.handle({ method: "agents.list" }, REMOTE);
  expect(listed).toMatchObject({ agents: [{ ref: "global:livraison" }], notices: [], partialWatch: false });
});

test("a project agent asks the project for write access", async () => {
  const { h, rpc, asserted, projectDir } = rig(false);
  h.write(join(projectDir, "review-pr.md"), agentText("review-pr"));
  await rpc.handle({ method: "agents.list", projectId: PROJECT_ID }, LOCAL_CONTEXT);
  const agent = await rpc.handle(
    { method: "agents.read", ref: `project:${PROJECT_ID}:review-pr` },
    LOCAL_CONTEXT,
  );
  expect(agent).toMatchObject({ scope: "project" });
  await expect(
    rpc.handle({ method: "agents.delete", ref: `project:${PROJECT_ID}:review-pr` }, LOCAL_CONTEXT),
  ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  await expect(
    rpc.handle({ ...create, scope: "project", projectId: PROJECT_ID }, LOCAL_CONTEXT),
  ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  expect(asserted).toEqual([PROJECT_ID, PROJECT_ID]);
});

test("create, settings, versions and preview go through the service", async () => {
  const { rpc, previews } = rig();
  await rpc.handle(create, LOCAL_CONTEXT);
  const agent = await rpc.handle(
    { method: "agents.settings", ref: "global:review-pr", patch: { maxParallel: 2 } },
    LOCAL_CONTEXT,
  );
  expect(agent).toMatchObject({ ref: "global:review-pr", settings: { maxParallel: 2 } });
  const versions = await rpc.handle(
    { method: "fileVersions.list", kind: "agents", ref: "global:review-pr" },
    LOCAL_CONTEXT,
  );
  expect(versions).toMatchObject([{ origin: "kibo", by: "adam" }]);
  const id = Array.isArray(versions) ? String(versions[0]?.id) : "";
  const read = await rpc.handle({ method: "fileVersions.read", id }, LOCAL_CONTEXT);
  expect(read).toMatchObject({ version: { id }, content: expect.stringContaining("name: review-pr") });
  expect(await rpc.handle({ method: "agents.preview", ref: "global:review-pr" }, LOCAL_CONTEXT)).toBe(
    PREVIEW,
  );
  expect(previews).toEqual([{ method: "agents.preview", ref: "global:review-pr" }]);
});

test("a skill version is restored by the skills service only when one is wired", async () => {
  const { rpc, history } = rig();
  const version = history.deposit({
    kind: "skills",
    ref: "user:deploy",
    file: "SKILL.md",
    content: "x",
    origin: "kibo",
    by: null,
    note: null,
  });
  await expect(
    rpc.handle({ method: "fileVersions.restore", id: version.id, baseHash: null }, LOCAL_CONTEXT),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
});

test("a remote session is refused a restore before the version is even looked up", async () => {
  const { rpc } = rig();
  await expect(
    rpc.handle({ method: "fileVersions.restore", id: "absent", baseHash: null }, REMOTE),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

test("restoring a project skill version checks that its project is writable", async () => {
  const restored: string[] = [];
  const s = rig(false);
  const rpc = agentFilesRpc(s.service, async () => PREVIEW, {
    viewer: () => "adam",
    assertWritable: (projectId) => {
      throw new KiboError("PERMISSION_DENIED", `read only ${projectId}`);
    },
    restoreSkill: async (id) => {
      restored.push(id);
      return { ok: false, conflict: { content: "", hash: "h", modifiedAt: 0 } };
    },
  });
  const version = s.history.deposit({
    kind: "skills",
    ref: `project:${PROJECT_ID}:my.skill`,
    file: "SKILL.md",
    content: "x",
    origin: "kibo",
    by: null,
    note: null,
  });
  await expect(
    rpc.handle({ method: "fileVersions.restore", id: version.id, baseHash: null }, LOCAL_CONTEXT),
  ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  expect(restored).toEqual([]);
});
