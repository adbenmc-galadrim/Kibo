import { expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseAgentFile } from "@kibo/core/agents/frontmatter";
import type { AgentFile } from "@kibo/schema";
import { contentHash } from "./guarded-write";
import { DESCRIPTION, makeService } from "./service.test-helper";
import { agentText, OTHER_PROJECT_ID, PROJECT_ID } from "./test-home.test-helper";

const fileOf = (text: string): AgentFile => {
  const parsed = parseAgentFile(text);
  if (!("file" in parsed)) throw new Error(parsed.problem);
  return parsed.file;
};

const loaded = (file: AgentFile | null): AgentFile => {
  if (file === null) throw new Error("agent file expected");
  return file;
};

test("create writes the file from its template, a kibo version, and emits", async () => {
  const { service, history, emitted, globalDir } = makeService();
  const { agent, missingSubagents } = await service.create(
    { scope: "global", name: "review-pr", description: DESCRIPTION, model: "opus", template: "review" },
    "adam",
  );
  const text = readFileSync(join(globalDir, "review-pr.md"), "utf8");
  expect(fileOf(text).frontmatter).toMatchObject({
    name: "review-pr",
    description: DESCRIPTION,
    model: "opus",
  });
  expect(text).toContain("# Review");
  expect(agent).toMatchObject({ ref: "global:review-pr", hash: contentHash(text), problem: null });
  expect(missingSubagents).toEqual([]);
  expect(history.list("agents", "global:review-pr").map((v) => [v.origin, v.by])).toEqual([["kibo", "adam"]]);
  expect(emitted).toEqual(["agent-files"]);
});

test("create refuses an existing file, a vague name, a reserved name and a short description", async () => {
  const { service } = makeService();
  const input = {
    scope: "global" as const,
    name: "review-pr",
    description: DESCRIPTION,
    template: "blank" as const,
  };
  await service.create(input, "adam");
  await expect(service.create(input, "adam")).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(service.create({ ...input, name: "opus" }, "adam")).rejects.toMatchObject({
    code: "INVALID_INPUT",
    message: expect.stringContaining("suggestion : relit-pr-rend"),
  });
  await expect(service.create({ ...input, name: "kibo-demo" }, "adam")).rejects.toMatchObject({
    code: "CONFLICT",
  });
  await expect(service.create({ ...input, name: "seo", description: "court" }, "adam")).rejects.toMatchObject(
    {
      code: "INVALID_INPUT",
    },
  );
});

test("a project agent needs its project and a local folder", async () => {
  const input = {
    scope: "project" as const,
    name: "review-pr",
    description: DESCRIPTION,
    template: "blank" as const,
  };
  await expect(makeService().service.create(input, "adam")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  const { service } = makeService({ projectFolder: false });
  await expect(service.create({ ...input, projectId: PROJECT_ID }, "adam")).rejects.toMatchObject({
    code: "PROJECT_FOLDER_MISSING",
  });
});

test("a conductor gets the delivery, review and SEO agents of its scope that exist", async () => {
  const { h, service, globalDir } = makeService();
  h.write(join(globalDir, "livraison.md"), agentText("livraison"));
  h.write(join(globalDir, "review.md"), agentText("review"));
  const { agent, missingSubagents } = await service.create(
    {
      scope: "global",
      name: "chef-orchestre",
      description: "Mène un ticket avec ses sous-agents",
      template: "conductor",
    },
    "adam",
  );
  expect(agent.settings.subagents).toEqual(["global:livraison", "global:review"]);
  expect(missingSubagents).toEqual(["seo"]);
});

test("save rewrites the file with its other fields intact and a kibo version", async () => {
  const { h, service, history, globalDir } = makeService();
  const original =
    "---\nname: review-pr\ndescription: Relit une PR\ncolor: blue\nhooks:\n  Stop: []\n---\n\nAncien";
  const path = h.write(join(globalDir, "review-pr.md"), original);
  await service.catalog.refresh();
  const file = fileOf(original);
  const result = await service.save(
    "global:review-pr",
    { ...file, body: "Nouveau" },
    contentHash(original),
    "adam",
  );
  expect(result.ok).toBe(true);
  const text = readFileSync(path, "utf8");
  expect(text).toContain("color: blue\nhooks:\n  Stop: []\n");
  expect(text.endsWith("Nouveau")).toBe(true);
  expect(history.list("agents", "global:review-pr").map((v) => v.origin)).toEqual(["kibo", "external"]);
});

test("save with a stale hash is a conflict and leaves the file alone", async () => {
  const { h, service, globalDir } = makeService();
  const path = h.write(join(globalDir, "review-pr.md"), agentText("review-pr"));
  await service.catalog.refresh();
  writeFileSync(path, agentText("review-pr", DESCRIPTION, "À la main"));
  const result = await service.save(
    "global:review-pr",
    fileOf(agentText("review-pr")),
    contentHash(agentText("review-pr")),
    "adam",
  );
  expect(result).toMatchObject({
    ok: false,
    conflict: { content: agentText("review-pr", DESCRIPTION, "À la main") },
  });
  expect(readFileSync(path, "utf8")).toContain("À la main");
});

test("save refuses a name field that differs from the reference, accepts a Kibo agent", async () => {
  const { service } = makeService();
  await service.ensureSystemAgents();
  const demo = service.read("system:demo");
  const file = loaded(demo.file);
  await expect(
    service.save(
      "system:demo",
      { ...file, frontmatter: { ...file.frontmatter, name: "autre" } },
      demo.hash,
      "adam",
    ),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  const saved = await service.save(
    "system:demo",
    { frontmatter: { ...file.frontmatter, model: "haiku" }, body: "Joue." },
    demo.hash,
    "adam",
  );
  expect(saved.ok && saved.value.file?.frontmatter.model).toBe("haiku");
});

test("save on a deleted file is NOT_FOUND", async () => {
  const { service } = makeService();
  await expect(
    service.save("global:absent", fileOf(agentText("absent")), contentHash("x"), "adam"),
  ).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

test("delete keeps a last version, removes the file and the settings, refuses with active runs", async () => {
  const { h, service, settings, history, active, globalDir } = makeService();
  const path = h.write(join(globalDir, "review-pr.md"), agentText("review-pr"));
  await service.catalog.refresh();
  settings.set("global:review-pr", { maxParallel: 2 });
  active.set("global:review-pr", 1);
  await expect(service.delete("global:review-pr", "adam")).rejects.toMatchObject({ code: "AGENT_IN_USE" });
  active.clear();
  await service.delete("global:review-pr", "adam");
  expect(existsSync(path)).toBe(false);
  expect(settings.getStored("global:review-pr")).toBeNull();
  expect(history.list("agents", "global:review-pr")[0]?.origin).toBe("delete");
  await expect(service.delete("system:demo", "adam")).rejects.toMatchObject({ code: "FORBIDDEN" });
});

test("subagents must be global or of the same project, never a Kibo agent", async () => {
  const { h, service, globalDir, projectDir } = makeService();
  h.write(join(globalDir, "chef.md"), agentText("chef"));
  h.write(join(projectDir, "chef-projet.md"), agentText("chef-projet"));
  await service.catalog.refresh();
  expect(() => service.settings("global:chef", { subagents: [`project:${OTHER_PROJECT_ID}:x`] })).toThrow(
    "another project",
  );
  expect(() => service.settings("global:chef", { subagents: ["system:demo"] })).toThrow("subagent");
  expect(service.settings("global:chef", { subagents: ["global:review"] }).subagents).toEqual([
    "global:review",
  ]);
  const local = `project:${PROJECT_ID}:x` as const;
  expect(service.settings(`project:${PROJECT_ID}:chef-projet`, { subagents: [local] }).subagents).toEqual([
    local,
  ]);
});

test("a Kibo agent only changes enabled and its parallelism", async () => {
  const { service } = makeService();
  await service.ensureSystemAgents();
  expect(() => service.settings("system:assistant", { workspace: "repo" })).toThrow("enabled");
  expect(service.settings("system:assistant", { enabled: false }).enabled).toBe(false);
  expect(() => service.settings("system:demo", { maxParallel: 2 })).toThrow("one ticket");
});

test("rename moves the file, the settings and the references, keeping the old file in the history", async () => {
  const { h, service, settings, history, globalDir } = makeService();
  h.write(join(globalDir, "relecture.md"), agentText("relecture"));
  h.write(join(globalDir, "chef.md"), agentText("chef"));
  h.write(join(globalDir, "livraison.md"), agentText("livraison"));
  await service.catalog.refresh();
  settings.set("global:relecture", { maxParallel: 3 });
  settings.set("global:chef", { subagents: ["global:relecture"] });
  const renamed = await service.rename("global:relecture", "review-pr", "adam");
  expect(renamed).toMatchObject({ ref: "global:review-pr", file: { frontmatter: { name: "review-pr" } } });
  expect(renamed.settings.maxParallel).toBe(3);
  expect(existsSync(join(globalDir, "relecture.md"))).toBe(false);
  expect(history.list("agents", "global:relecture")[0]?.origin).toBe("delete");
  expect(settings.get("global:chef").subagents).toEqual(["global:review-pr"]);
  await expect(service.rename("global:review-pr", "livraison", "adam")).rejects.toMatchObject({
    code: "CONFLICT",
  });
});

test("restore is an ordinary guarded write with a restore version", async () => {
  const { h, service, history, globalDir } = makeService();
  const path = h.write(join(globalDir, "review-pr.md"), agentText("review-pr", DESCRIPTION, "v1"));
  await service.catalog.refresh();
  const [first] = history.list("agents", "global:review-pr");
  const agent = service.read("global:review-pr");
  await service.save(
    "global:review-pr",
    fileOf(agentText("review-pr", DESCRIPTION, "v2")),
    agent.hash,
    "adam",
  );
  const stale = await service.versions.restore(first?.id ?? "", agent.hash, "adam");
  expect(stale.ok).toBe(false);
  const restored = await service.versions.restore(
    first?.id ?? "",
    service.read("global:review-pr").hash,
    "adam",
  );
  expect(restored).toMatchObject({ ok: true, value: { origin: "restore", by: "adam" } });
  expect(readFileSync(path, "utf8")).toBe(agentText("review-pr", DESCRIPTION, "v1"));
});

test("ensureSystemAgents creates the four files once and never rewrites an existing one", async () => {
  const { h, service, globalDir } = makeService();
  const own = h.write(
    join(globalDir, "kibo-assistant.md"),
    agentText("kibo-assistant", DESCRIPTION, "À moi"),
  );
  await service.ensureSystemAgents();
  for (const name of ["kibo-generateur", "kibo-demo", "kibo-project-agent"]) {
    expect(existsSync(join(globalDir, `${name}.md`))).toBe(true);
  }
  expect(readFileSync(own, "utf8")).toBe(agentText("kibo-assistant", DESCRIPTION, "À moi"));
  const project = service.read("system:project-agent");
  expect(project.file?.body.length).toBeGreaterThan(20);
  expect(project.file?.frontmatter.model).toBeUndefined();
  expect(service.read("system:demo").file?.body).toBe("");
  const before = project.hash;
  await service.ensureSystemAgents();
  expect(service.read("system:project-agent").hash).toBe(before);
  expect(service.read("system:generateur").settings).toMatchObject({ workspace: "isolated", maxParallel: 2 });
});

test("list gives summaries and the notices only once", async () => {
  const { service, notices } = makeService();
  await service.ensureSystemAgents();
  notices.add([{ profileName: "opus", text: "Profil opus : …" }]);
  const first = service.list(null);
  expect(first.agents.map((a) => a.name)).toEqual([
    "kibo-assistant",
    "kibo-demo",
    "kibo-generateur",
    "kibo-project-agent",
  ]);
  expect(first.notices).toHaveLength(1);
  expect(first.partialWatch).toBe(false);
  expect(service.list(null).notices).toEqual([]);
});
