import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ConfigCommand, Domain, GuidelineOwner, ProjectMeta } from "@kibo/schema";
import { call, createService } from "../service";
import { openStore } from "../store";

const homes: string[] = [];
afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

test("the brief reads its guidelines in a stable order: workspace, project domains by name, project", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-order-"));
  homes.push(home);
  const s = createService(openStore(home), { user: "adam" });
  const meta: ProjectMeta = call(s, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#F97316",
  });
  const config = <T>(command: ConfigCommand) => s.handle({ method: "config", command }) as T;
  const color = "#14B8A6";
  const owner = { scope: "project", projectId: meta.id } as const;
  const zeta = config<Domain>({ method: "createDomain", domain: { name: "Zeta", color }, owner });
  const alpha = config<Domain>({ method: "createDomain", domain: { name: "Alpha", color }, owner });
  const file = (o: GuidelineOwner, path: string) =>
    config({ method: "addGuideline", owner: o, path, content: path });
  file({ scope: "domain", domainId: zeta.id, projectId: meta.id }, "z2.md");
  file({ scope: "domain", domainId: zeta.id, projectId: meta.id }, "z1.md");
  file({ scope: "domain", domainId: alpha.id, projectId: meta.id }, "a1.md");
  file(owner, "p2.md");
  file(owner, "p1.md");
  file({ scope: "workspace" }, "w2.md");
  file({ scope: "workspace" }, "w1.md");
  const read = () => s.agentData.guidelines(meta.id).map((g) => g.path);
  expect(read()).toEqual(["w1.md", "w2.md", "a1.md", "z1.md", "z2.md", "p1.md", "p2.md"]);
  expect(read()).toEqual(read());
});
