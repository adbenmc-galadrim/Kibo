import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WorktreeSettings } from "@kibo/schema";
import { parseRegistry, type RegistryEntry, registryToSettings } from "./registry-import";

const HOME = "/home/dev";
const registry = parseRegistry(
  JSON.parse(readFileSync(join(import.meta.dir, "fixtures", "registry.json"), "utf8")),
);
const entry = (name: string): RegistryEntry => {
  const found = registry[name];
  if (!found) throw new Error(`missing ${name}`);
  return found;
};
const PROFILE =
  "## Publication\n\n`draft` — push\n\n## Autorisations\n\n- `Bash(pnpm *)`\n- `Bash(sh -c *)`\n";

test("the registry lists its three projects", () => {
  expect(Object.keys(registry).sort()).toEqual(["atlas", "nimbus", "silo"]);
});

test("silo becomes worktree and delivery settings of Kibo", () => {
  const { worktree, delivery, notices } = registryToSettings(entry("silo"), {
    home: HOME,
    profileText: PROFILE,
  });
  expect(worktree).toEqual({
    baseRef: "origin/dev",
    pathTemplate: "../silo-{slug}",
    setup: null,
    recipe: {
      copyFrom: ["{repo}", "{sibling}"],
      copy: [".env"],
      env: {
        file: ".env",
        ports: { keys: { WEB_PORT: 3000, SERVER_PORT: 3001 }, from: 1, step: 10, count: 32 },
        replace: {},
        set: {},
      },
      after: ["pnpm install"],
    },
  });
  expect(WorktreeSettings.parse(worktree)).toEqual(worktree);
  expect(delivery).toEqual({
    agent: null,
    root: "/home/dev/Documents/silo",
    profile: "/home/dev/Documents/silo/delivery-profile.md",
    memory: "/home/dev/.claude/projects/-Users-galadrim-Documents-silo/memory/MEMORY.md",
    briefs: "/home/dev/Documents/silo/kibo-notes/briefs",
    reports: "/home/dev/Documents/silo/kibo-notes/revues",
    todo: "/home/dev/Documents/silo/TODO.md",
    idPattern: "^C[0-9A-Z]*-[0-9]+$",
    publication: "draft",
    allow: ["Bash(pnpm *)"],
    addDirs: ["/home/dev/Documents/silo", "/home/dev/.claude/projects/-Users-galadrim-Documents-silo/memory"],
  });
  expect(notices).toEqual(["Règle refusée par Kibo : Bash(sh -c *)"]);
});

test("nimbus renames the short slug in the database replacement and assignments", () => {
  const { worktree } = registryToSettings(entry("nimbus"), { home: HOME, profileText: null });
  expect(worktree.pathTemplate).toBe("../nimbus-{short}");
  expect(worktree.recipe?.env?.replace).toEqual({ DATABASE_URL: ["/[^/?]+(\\?|$)", "/nimbus_{short_}$1"] });
  expect(worktree.recipe?.env?.set).toEqual({
    DATABASE_NAME: "nimbus_{short_}",
    BETTER_AUTH_URL: "http://localhost:{BACKEND_PORT}",
    EXPO_PUBLIC_BACKEND_URL: "http://localhost:{BACKEND_PORT}",
  });
  expect(worktree.recipe?.after[0]).toBe(
    "docker exec nimbus-postgres createdb -U postgres nimbus_{short_} 2>/dev/null || true",
  );
  expect(worktree.recipe?.copy).toEqual([".env", ".galacryptkey"]);
});

test("atlas keeps its folders, expands the home and has no env", () => {
  const { worktree, delivery } = registryToSettings(entry("atlas"), { home: HOME, profileText: "" });
  expect(worktree.baseRef).toBe("origin/staging");
  expect(worktree.pathTemplate).toBe("../atlas-{short}");
  expect(worktree.recipe?.copyFrom).toEqual(["/home/dev/Documents/atlas/atlas-staging", "{repo}"]);
  expect(worktree.recipe?.env).toBeNull();
  expect(worktree.recipe?.after).toEqual([
    "~/Documents/atlas/bin/atlas-sweep --reap --keep {short} --yes",
    "make pr-up",
  ]);
  expect(delivery.publication).toBeNull();
  expect(delivery.allow).toEqual([]);
});

test("a missing profile is reported and nothing else is invented", () => {
  const { notices, delivery } = registryToSettings(entry("nimbus"), { home: HOME, profileText: null });
  expect(notices).toEqual(["Profil illisible : /home/dev/Documents/nimbus/delivery-profile.md"]);
  expect(delivery.publication).toBeNull();
});

test("a minimal entry keeps the Kibo defaults and refuses what it cannot transpose", () => {
  const minimal = parseRegistry({
    projects: {
      tiny: {
        repo: "~/code/tiny",
        base: "main",
        root: "/etc",
        memory: "~/.ssh/notes.md",
        plan: { idPattern: "(" },
        worktree: { dir: "~/code/tiny-{slug}", copy: ["../secret", ".env"] },
      },
    },
  }).tiny;
  if (!minimal) throw new Error("missing tiny");
  const { worktree, delivery, notices } = registryToSettings(minimal, { home: HOME, profileText: null });
  expect(worktree.recipe).toEqual({ copyFrom: [], copy: [".env"], env: null, after: [] });
  expect(delivery.idPattern).toBeNull();
  expect(delivery.addDirs).toEqual([]);
  expect(notices).toEqual([
    "Format des identifiants invalide : (",
    "Copie refusée : ../secret",
    "Dossier refusé : /etc",
    "Dossier refusé : /home/dev/.ssh",
  ]);
});

test("an entry without worktree folder keeps the default path", () => {
  const bare = parseRegistry({ projects: { bare: { repo: "/srv/bare", base: "main" } } }).bare;
  if (!bare) throw new Error("missing bare");
  const { worktree, delivery } = registryToSettings(bare, { home: HOME, profileText: null });
  expect(worktree).toEqual({
    baseRef: "origin/main",
    pathTemplate: ".kibo/worktrees/{slug}",
    setup: null,
    recipe: null,
  });
  expect(delivery.root).toBeNull();
});

test("a malformed registry is refused", () => {
  expect(() => parseRegistry({ projects: { x: { base: "main" } } })).toThrow();
  expect(() => parseRegistry([])).toThrow();
});

test("a recipe Kibo cannot accept is dropped with a notice", () => {
  const wide = parseRegistry({
    projects: {
      wide: {
        repo: "/srv/wide/wide",
        base: "main",
        worktree: {
          dir: "/srv/wide/wide-{slug}",
          env: { file: ".env", ports: { keys: { web: 3000 }, from: 1, step: 1, count: 500 } },
        },
      },
    },
  }).wide;
  if (!wide) throw new Error("missing wide");
  const { worktree, notices } = registryToSettings(wide, { home: HOME, profileText: null });
  expect(worktree.pathTemplate).toBe("../wide-{short}");
  expect(worktree.recipe).toBeNull();
  expect(notices).toEqual(["Recette ignorée : env.ports.keys.web, env.ports.count"]);
});

test("a worktree folder Kibo would refuse keeps the default path with a notice", () => {
  const far = parseRegistry({
    projects: { far: { repo: "/srv/a/b/repo", base: "main", worktree: { dir: "/elsewhere/{slug}" } } },
  }).far;
  if (!far) throw new Error("missing far");
  const { worktree, notices } = registryToSettings(far, { home: HOME, profileText: null });
  expect(worktree.pathTemplate).toBe(".kibo/worktrees/{slug}");
  expect(notices).toEqual(["Dossier des worktrees refusé : ../../../../elsewhere/{short}"]);
});
