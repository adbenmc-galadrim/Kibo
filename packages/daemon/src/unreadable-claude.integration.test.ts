import { expect, test } from "bun:test";
import { chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Skill } from "@kibo/schema";
import { type AgentList, agentMd, put, skillMd, startKit } from "./agents-skills.test-helper";

const UNREADABLE = "fichier illisible";

test("unreadable files in the Claude folder never stop the daemon and show as unreadable", async () => {
  const kit = await startKit({
    prepare(claude) {
      const agent = join(claude, "agents", "secret.md");
      const skill = join(claude, "skills", "secret", "SKILL.md");
      put(agent, agentMd("secret", "Garde un secret sans le dire"));
      put(skill, skillMd("secret", "Un skill caché"));
      chmodSync(agent, 0o000);
      chmodSync(skill, 0o000);
      return () => {
        chmodSync(agent, 0o644);
        chmodSync(skill, 0o644);
      };
    },
  });
  const agents = (await kit.rpc<AgentList>({ method: "agents.list" })).agents;
  expect(agents.find((a) => a.name === "secret")?.problem).toBe(UNREADABLE);
  expect(agents.map((a) => a.name)).toContain("kibo-demo");
  const skills = (await kit.rpc<{ skills: Skill[] }>({ method: "skills.list" })).skills;
  expect(skills.find((s) => s.id === "secret")).toMatchObject({ problem: UNREADABLE, file: null });
}, 60_000);

test("an agents folder without rights never stops the daemon", async () => {
  const kit = await startKit({
    prepare(claude) {
      const agents = join(claude, "agents");
      const skills = join(claude, "skills");
      mkdirSync(agents, { recursive: true });
      mkdirSync(skills, { recursive: true });
      chmodSync(agents, 0o000);
      chmodSync(skills, 0o000);
      return () => {
        chmodSync(agents, 0o755);
        chmodSync(skills, 0o755);
      };
    },
  });
  expect((await kit.raw({ method: "agents.list" })).ok).toBe(true);
  expect((await kit.raw({ method: "skills.list" })).ok).toBe(true);
}, 60_000);
