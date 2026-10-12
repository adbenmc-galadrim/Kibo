import { expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_AGENT_SETTINGS } from "@kibo/schema";
import { type AgentCatalogInput, createAgentCatalog } from "./catalog";
import { createFileHistory } from "./file-history";
import { contentHash } from "./guarded-write";
import { createAgentSettingsStore } from "./settings-store";
import { agentText, makeTestHome, PROJECT_ID } from "./test-home.test-helper";
import type { WatchPathsFn } from "./watch";

const setup = (extra: Partial<AgentCatalogInput> = {}) => {
  const h = makeTestHome();
  const settings = createAgentSettingsStore(h.db);
  const history = createFileHistory({ home: h.kiboHome, db: h.db });
  const global = join(h.claudeHome, "agents");
  const project = join(h.projectFolder, ".claude", "agents");
  h.write(join(global, "review-pr.md"), agentText("review-pr"));
  h.write(join(global, "livraison.md"), agentText("livraison"));
  h.write(join(project, "review-pr.md"), agentText("review-pr"));
  const catalog = createAgentCatalog({
    roots: h.roots,
    projects: () => [{ id: PROJECT_ID, folder: h.projectFolder }],
    settings,
    history,
    activeRuns: (ref) => (ref === "global:livraison" ? 2 : 0),
    watch: () => ({ mode: () => "watch", close: () => undefined }),
    ...extra,
  });
  return { h, settings, history, catalog, global, project };
};

test("a global agent shadowed in a project says so, settings and active runs are applied", async () => {
  const { catalog, settings } = setup();
  settings.set("global:livraison", { maxParallel: 3 });
  await catalog.refresh();
  const list = catalog.list(PROJECT_ID);
  const byRef = (ref: string) => list.find((a) => a.ref === ref);
  expect(byRef("global:review-pr")?.shadowedBy).toBe(`project:${PROJECT_ID}:review-pr`);
  expect(byRef(`project:${PROJECT_ID}:review-pr`)?.shadowedBy).toBeNull();
  expect(byRef("global:livraison")).toMatchObject({
    shadowedBy: null,
    activeRuns: 2,
    settings: { ...DEFAULT_AGENT_SETTINGS, maxParallel: 3 },
  });
  expect(catalog.byRef("global:review-pr")?.shadowedBy).toBeNull();
  expect(catalog.byRef("global:absent")).toBeNull();
});

test("without a project the list holds every agent, from every project with a folder", async () => {
  const { catalog } = setup();
  await catalog.refresh();
  expect(catalog.list(null).map((a) => a.ref)).toEqual([
    "global:livraison",
    "global:review-pr",
    `project:${PROJECT_ID}:review-pr`,
  ]);
  expect(catalog.list("autre").map((a) => a.ref)).toEqual(["global:livraison", "global:review-pr"]);
});

test("a refresh picks up a new file", async () => {
  const { h, catalog, global } = setup();
  await catalog.refresh();
  h.write(join(global, "seo-contenu.md"), agentText("seo-contenu"));
  await catalog.refresh();
  expect(catalog.byRef("global:seo-contenu")).not.toBeNull();
});

test("a watched change refreshes the catalog, then notifies", async () => {
  const fires: (() => void)[] = [];
  const watch: WatchPathsFn = (_targets, onChange) => {
    fires.push(() => onChange(null));
    return { mode: () => "watch", close: () => undefined };
  };
  const { h, catalog, global } = setup({ watch });
  await catalog.refresh();
  h.write(join(global, "seo-contenu.md"), agentText("seo-contenu"));
  const notified = new Promise<void>((resolve) => catalog.onChange(resolve));
  for (const fire of fires) fire();
  await notified;
  expect(catalog.byRef("global:seo-contenu")).not.toBeNull();
});

test("more than 500 folders makes the watch partial", async () => {
  const h = makeTestHome();
  const projects = Array.from({ length: 501 }, (_, i) => {
    const folder = join(h.root, `p${i}`);
    mkdirSync(join(folder, ".claude", "agents"), { recursive: true });
    return { id: `p${i}`, folder };
  });
  let watched = 0;
  const catalog = createAgentCatalog({
    roots: h.roots,
    projects: () => projects,
    settings: createAgentSettingsStore(h.db),
    history: createFileHistory({ home: h.kiboHome, db: h.db }),
    activeRuns: () => 0,
    watch: (targets) => {
      watched = targets.length;
      return { mode: () => "watch", close: () => undefined };
    },
  });
  await catalog.refresh();
  expect(catalog.partialWatch()).toBe(true);
  expect(watched).toBe(500);
});

test("an unknown hash seen on the disk becomes one external version", async () => {
  const { h, catalog, history, global } = setup();
  await catalog.refresh();
  expect(history.list("agents", "global:livraison").map((v) => v.origin)).toEqual(["external"]);
  h.write(join(global, "livraison.md"), agentText("livraison", "Livre un ticket de bout en bout", "Modifié"));
  await catalog.refresh();
  await catalog.refresh();
  expect(history.list("agents", "global:livraison").map((v) => v.origin)).toEqual(["external", "external"]);
});

test("an expected hash written by Kibo is not recorded as external", async () => {
  const { h, catalog, history, global } = setup();
  await catalog.refresh();
  const content = agentText("livraison", "Livre un ticket de bout en bout", "Par Kibo");
  catalog.expect(contentHash(content));
  h.write(join(global, "livraison.md"), content);
  await catalog.refresh();
  expect(history.list("agents", "global:livraison")).toHaveLength(1);
});

test("an expected hash never seen is forgotten after the next scan", async () => {
  const { h, catalog, history, global } = setup();
  await catalog.refresh();
  const content = agentText("livraison", "Livre un ticket de bout en bout", "Plus tard");
  catalog.expect(contentHash(content));
  await catalog.refresh();
  h.write(join(global, "livraison.md"), content);
  await catalog.refresh();
  expect(history.list("agents", "global:livraison").map((v) => v.origin)).toEqual(["external", "external"]);
});
