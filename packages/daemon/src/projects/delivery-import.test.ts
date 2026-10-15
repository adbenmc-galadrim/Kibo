import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectMeta } from "@kibo/schema";
import { git } from "../agents/git-test-kit";
import { createProjectSettings } from "../notes/settings";
import { createService } from "../service";
import { openStore } from "../store";
import { applyDeliveryImport, type DeliveryImportDeps, importDelivery } from "./delivery-import";

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-delivery-import-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const PROFILE = "## Publication\n\n`draft` — push\n\n## Autorisations\n\n- `Bash(pnpm *)`\n";

function world() {
  const home = tmp();
  const emis = join(home, "Documents", "emis");
  const repo = join(emis, "emis");
  const memory = join(home, ".claude", "projects", "-home-emis", "memory");
  mkdirSync(repo, { recursive: true });
  mkdirSync(memory, { recursive: true });
  writeFileSync(join(emis, "delivery-profile.md"), PROFILE);
  writeFileSync(join(memory, "MEMORY.md"), "# mémoire\n");
  const registry = {
    projects: {
      emis: {
        root: "~/Documents/emis",
        repo: "~/Documents/emis/emis",
        remote: "galadrimteam/emis-suivi-chantier",
        base: "dev",
        profile: "~/Documents/emis/delivery-profile.md",
        memory: "~/.claude/projects/-home-emis/memory/MEMORY.md",
        briefs: "~/Documents/emis/kibo-notes/briefs",
        plan: { idPattern: "^C[0-9A-Z]*-[0-9]+$" },
        worktree: { dir: "~/Documents/emis/emis-{dashed}", copy: [".env"], after: ["pnpm install"] },
      },
      ghost: { repo: "~/Documents/ghost", remote: "acme/ghost", base: "main" },
    },
  };
  const registryPath = join(home, "registry.json");
  writeFileSync(registryPath, JSON.stringify(registry));
  const store = openStore(join(home, ".kibo"));
  const service = createService(store, { user: "adam" });
  const settings = createProjectSettings(store.db);
  const create = (key: string, folder: string | null) =>
    service.handle({ method: "createProject", name: key, key, folder, color: "#F97316" }) as ProjectMeta;
  const deps: DeliveryImportDeps = { home, env: {}, docs: service.docs };
  return { home, emis, repo, memory, registryPath, store, service, settings, create, deps };
}

test("a project whose folder resolves to the registry repo is matched, one without folder is not", async () => {
  const w = world();
  const link = join(w.home, "lien-emis");
  symlinkSync(w.repo, link);
  const linked = w.create("EMIS", link);
  w.create("NOPE", null);
  const result = await importDelivery(w.deps, w.registryPath);
  expect(result.registryPath).toBe(w.registryPath);
  const [emis, ghost] = result.candidates;
  expect(emis?.name).toBe("emis");
  expect(emis?.repo).toBe(w.repo);
  expect(emis?.remote).toBe("galadrimteam/emis-suivi-chantier");
  expect(emis?.matched).toBe(linked.id);
  expect(emis?.preview.worktree).toMatchObject({ baseRef: "origin/dev", pathTemplate: "../emis-{slug}" });
  expect(emis?.preview.delivery).toMatchObject({
    root: w.emis,
    publication: "draft",
    allow: ["Bash(pnpm *)"],
    addDirs: [w.emis, w.memory],
  });
  expect(ghost?.matched).toBeNull();
  w.store.close();
});

test("without a matching folder, the git origin of a project matches the registry remote", async () => {
  const w = world();
  const other = join(w.home, "clone");
  mkdirSync(other);
  await git(["init", "-q"], other);
  await git(["remote", "add", "origin", "git@github.com:galadrimteam/emis-suivi-chantier.git"], other);
  const cloned = w.create("CLONE", other);
  const [emis] = (await importDelivery(w.deps, w.registryPath)).candidates;
  expect(emis?.matched).toBe(cloned.id);
  w.store.close();
});

test("missing folders are left out of the added folders", async () => {
  const w = world();
  rmSync(w.memory, { recursive: true });
  const [emis] = (await importDelivery(w.deps, w.registryPath)).candidates;
  expect(emis?.preview.delivery.addDirs).toEqual([w.emis]);
  w.store.close();
});

test("an absent registry gives no candidate, a malformed one is refused", async () => {
  const w = world();
  const absent = join(w.home, "absent.json");
  expect(await importDelivery(w.deps, absent)).toEqual({ registryPath: absent, candidates: [] });
  writeFileSync(w.registryPath, "{ pas du json");
  await expect(importDelivery(w.deps, w.registryPath)).rejects.toThrow("INVALID_INPUT");
  w.store.close();
});

test("the registry path comes from DELIVERY_REGISTRY, then the skill folder", async () => {
  const w = world();
  const fromEnv = await importDelivery({ ...w.deps, env: { DELIVERY_REGISTRY: w.registryPath } });
  expect(fromEnv.candidates.map((c) => c.name)).toEqual(["emis", "ghost"]);
  const fromSkill = await importDelivery(w.deps);
  expect(fromSkill.registryPath).toBe(
    join(w.home, ".claude", "skills", "full-delivery", "projects", "registry.json"),
  );
  w.store.close();
});

test("applying the import is idempotent, keeps the chosen agent and the Kibo setup, and writes nothing else", async () => {
  const w = world();
  const project = w.create("EMIS", w.repo);
  w.service.docs.updateProjectMeta(
    project.id,
    {
      worktree: { baseRef: "main", pathTemplate: "../x-{slug}", setup: "make up", recipe: null },
      delivery: {
        agent: "global:full-delivery",
        root: null,
        profile: null,
        memory: null,
        briefs: null,
        reports: null,
        todo: null,
        idPattern: null,
        publication: null,
        allow: [],
        addDirs: [],
      },
    },
    false,
  );
  const registryBefore = readFileSync(w.registryPath, "utf8");
  const input = { projectId: project.id, name: "emis", registryPath: w.registryPath };
  const first = await applyDeliveryImport(w.deps, input);
  const second = await applyDeliveryImport(w.deps, input);
  expect(second).toEqual(first);
  expect(first.worktree).toMatchObject({
    baseRef: "origin/dev",
    pathTemplate: "../emis-{slug}",
    setup: "make up",
  });
  expect(first.worktree?.recipe?.after).toEqual(["pnpm install"]);
  expect(first.delivery).toMatchObject({ agent: "global:full-delivery", idPattern: "^C[0-9A-Z]*-[0-9]+$" });
  expect(w.service.docs.projectMeta(project.id).delivery).toEqual(first.delivery);
  expect(readFileSync(w.registryPath, "utf8")).toBe(registryBefore);
  await expect(applyDeliveryImport(w.deps, { ...input, name: "inconnu" })).rejects.toThrow("NOT_FOUND");
  await expect(applyDeliveryImport(w.deps, { ...input, name: "constructor" })).rejects.toThrow("NOT_FOUND");
  w.store.close();
});
