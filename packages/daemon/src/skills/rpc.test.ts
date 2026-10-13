import { expect, test } from "bun:test";
import { KiboError, type RpcRequest, SKILL_RPC, type Skill } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { cleanSkillDirs, NO_USAGE, PROJECT_ID, tempDir } from "./fakes.test-helper";
import { createSkillReviews } from "./reviews";
import { openSkillReviewStore } from "./reviews-store";
import { skillsRpc } from "./rpc";
import type { SkillsService } from "./service";

cleanSkillDirs();

const REMOTE = { sessionHash: "remote", remote: true };

const skill = (id: string, projectId: string | null): Skill => ({
  id,
  source: projectId ? "project" : "user",
  projectId,
  plugin: null,
  name: id,
  description: "",
  path: `/skills/${id}`,
  file: null,
  problem: null,
  hash: null,
  readOnly: false,
  shadowedBy: null,
  files: [],
  usage: NO_USAGE,
  reviews: { open: 0 },
  modifiedAt: null,
});

function rig(writable = true) {
  const calls: string[] = [];
  const skills = [skill("deploy", null), skill("tests", PROJECT_ID)];
  const service: SkillsService = {
    list: (projectId) => {
      calls.push(`list:${projectId}`);
      return { skills, partialWatch: false };
    },
    read: async ({ id }, file) => {
      calls.push(`read:${id}:${file}`);
      return { content: "", hash: "h", modifiedAt: 1, file: file ?? "SKILL.md" };
    },
    save: async (input) => {
      calls.push(`save:${input.id}:${input.by}:${input.reviewId}`);
      return { ok: true, value: { hash: "h", modifiedAt: 1 } };
    },
    create: async (input, by) => {
      calls.push(`create:${input.name}:${input.projectId}:${by}`);
      return skills[0] ?? skill("x", null);
    },
    copy: async ({ id, scope }, to, name, by) => {
      calls.push(`copy:${id}:${scope}:${to.source}:${name}:${by}`);
      return { skill: skill("x", null), citedBy: [] };
    },
    delete: async ({ id }, by) => {
      calls.push(`delete:${id}:${by}`);
    },
    assets: async ({ id }) => {
      calls.push(`assets:${id}`);
      return [];
    },
    removeAsset: async ({ id }, file, by) => {
      calls.push(`removeAsset:${id}:${file}:${by}`);
    },
    restore: async () => {
      throw new KiboError("INTERNAL", "not used");
    },
    locate: ({ id }) => {
      const found = skills.find((s) => s.id === id);
      if (!found) throw new KiboError("NOT_FOUND", `skill ${id} not found`);
      return found;
    },
    byId: (id) => skills.find((s) => s.id === id) ?? null,
    refresh: async () => {
      calls.push("refresh");
    },
    close: () => {},
  };
  const reviews = createSkillReviews({
    store: openSkillReviewStore(tempDir()),
    uses: { byRun: () => [{ skillId: "tests", count: 1 }] },
    skillPath: () => null,
    emit: () => calls.push("emit"),
  });
  const data = {
    viewer: () => "adam",
    skillsRule: (ref: string) => (ref === "global:dev" ? { mode: "all" as const } : null),
    assertWritable(projectId: string) {
      calls.push(`assert:${projectId}`);
      if (!writable) throw new KiboError("PERMISSION_DENIED", "read only");
    },
  };
  return { rpc: skillsRpc(service, reviews, data), calls, reviews };
}

const call = (rpc: ReturnType<typeof rig>["rpc"], req: RpcRequest, ctx = LOCAL_CONTEXT) =>
  rpc.handle(req, ctx);

test("the extension serves every skill method", () => {
  expect([...rig().rpc.methods]).toEqual(SKILL_RPC.map((s) => s.shape.method.value));
});

test("list refreshes first, reads and assets pass through", async () => {
  const { rpc, calls } = rig();
  await call(rpc, { method: "skills.list", projectId: PROJECT_ID });
  await call(rpc, { method: "skills.read", id: "deploy", file: "a.md" });
  await call(rpc, { method: "skills.assets", id: "deploy" });
  expect(calls).toEqual(["refresh", `list:${PROJECT_ID}`, "read:deploy:a.md", "assets:deploy"]);
});

test("writes carry the viewer and check the project only for project skills", async () => {
  const { rpc, calls } = rig();
  const hash = "a".repeat(64);
  await call(rpc, { method: "skills.save", id: "deploy", content: "x", baseHash: hash, reviewId: "r" });
  await call(rpc, { method: "skills.save", id: "tests", content: "x", baseHash: hash });
  await call(rpc, {
    method: "skills.create",
    source: "project",
    projectId: PROJECT_ID,
    name: "n",
    description: "d",
  });
  await call(rpc, { method: "skills.copy", id: "superpowers:x", to: { source: "user" }, name: "y" });
  const from = { scope: "plugin" as const, plugin: "superpowers" };
  await call(rpc, { method: "skills.copy", id: "superpowers:x", from, to: { source: "user" }, name: "z" });
  await call(rpc, { method: "skills.delete", id: "tests" });
  await call(rpc, { method: "skills.removeAsset", id: "deploy", file: "a.md" });
  expect(calls).toEqual([
    "save:deploy:adam:r",
    `assert:${PROJECT_ID}`,
    "save:tests:adam:undefined",
    `assert:${PROJECT_ID}`,
    `create:n:${PROJECT_ID}:adam`,
    "copy:superpowers:x:undefined:user:y:adam",
    "copy:superpowers:x:plugin:user:z:adam",
    `assert:${PROJECT_ID}`,
    "delete:tests:adam",
    "removeAsset:deploy:a.md:adam",
  ]);
});

test("a remote session or a reader cannot write", async () => {
  const remote = rig();
  const save = { method: "skills.save" as const, id: "deploy", content: "x", baseHash: null };
  await expect(call(remote.rpc, save, REMOTE)).rejects.toMatchObject({ code: "FORBIDDEN" });
  const reader = rig(false);
  await expect(call(reader.rpc, { ...save, id: "tests" })).rejects.toMatchObject({
    code: "PERMISSION_DENIED",
  });
  await expect(call(reader.rpc, { method: "skills.delete", id: "zzz" })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(remote.calls).toEqual([]);
});

test("reviews are listed and ignored by the viewer", async () => {
  const { rpc, reviews } = rig();
  const input = { reviews: [{ skill: "tests", verdict: "ok", note: "Bien." }] };
  await reviews.record(runView({ id: "r1", projectId: PROJECT_ID }), input);
  expect(await call(rpc, { method: "skillReviews.list", runId: "r1" })).toEqual(
    reviews.list({ runId: "r1" }),
  );
  const [listed] = reviews.list({ runId: "r1" });
  if (!listed) throw new Error("no review");
  const ignored = await call(rpc, { method: "skillReviews.decide", id: listed.id, decision: "ignore" });
  expect(ignored).toMatchObject({ status: "ignored", decidedBy: { kind: "human", ref: "adam" } });
  await expect(
    call(rpc, { method: "skillReviews.decide", id: "nope", decision: "ignore" }),
  ).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

test("suggestions list the skills an agent may use from a project, an unknown agent is refused", async () => {
  const { rpc, calls } = rig();
  const suggested = await call(rpc, {
    method: "skills.suggest",
    agentRef: "global:dev",
    projectId: PROJECT_ID,
  });
  expect(suggested).toMatchObject({ skills: [{ id: "deploy" }, { id: "tests" }] });
  expect(calls).toEqual(["refresh", `list:${PROJECT_ID}`]);
  await expect(call(rpc, { method: "skills.suggest", agentRef: "global:gone" })).rejects.toMatchObject({
    code: "AGENT_NOT_FOUND",
  });
});
