import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { listPages } from "@kibo/core";
import {
  buildComponent,
  hashSources,
  inferPermissions,
  scaffold,
  type Toolchain,
  validateComponent,
} from "@kibo/devkit";
import { Instance, isBuiltinId, KiboError, type ValidationReport } from "@kibo/schema";
import { parseDiff } from "../code/parse-diff";
import { DIFF_FLAGS } from "../code/read";
import { run } from "../code/run";
import { draftsDir } from "../components/drafts";
import type { Publisher } from "../components/publish";
import type { PublishLock } from "../components/publish-lock";
import type { RegistryService } from "../components/registry-service";
import { type Docs, USER_COMMAND } from "../docs";
import { catalogEntries, latestPublished, usagesOf } from "./adapters";
import { copySource, readDraftManifest, writeDraftManifest } from "./draft-files";
import { grantedFromKeys } from "./draft-permissions";
import type { ComponentCatalog, Devkit, Differ, ProjectAccess } from "./ports";

export type LiveComponents = {
  registry: Pick<RegistryService, "list" | "approve">;
  publisher: Pick<Publisher, "publish">;
  publishLock: PublishLock;
  usageChanged(): void;
};

export type Validate = (dir: string, signal: AbortSignal) => Promise<ValidationReport>;

export function devkitPort(opts: {
  home: string;
  toolchain: Toolchain;
  validate: Validate | null;
  signal: AbortSignal;
}): Devkit {
  const { home, toolchain, signal } = opts;
  return {
    async scaffold({ dir, id, title, kind, withServer, formats }) {
      mkdirSync(join(home, "tmp"), { recursive: true, mode: 0o700 });
      const root = mkdtempSync(join(home, "tmp", "scaffold-"));
      try {
        copySource(await scaffold({ root, id, kind, server: withServer, toolchain }), dir);
        writeDraftManifest(dir, { ...readDraftManifest(dir), title, description: title, formats });
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
    async infer(dir) {
      const { used, issues } = await inferPermissions(dir, toolchain);
      if (issues.length > 0) throw new KiboError("VALIDATION_FAILED", `${issues.length} source issue(s)`);
      return grantedFromKeys(used);
    },
    validate: (dir) =>
      opts.validate ? opts.validate(dir, signal) : validateComponent(dir, { toolchain, signal }),
    hash: (dir) => hashSources(dir),
    async buildPreview(dir) {
      const { files } = await buildComponent(dir, toolchain);
      const js = files["ui.sandbox.js"];
      const css = files["ui.css"];
      if (!js || !css) throw new KiboError("VALIDATION_FAILED", "the sandbox build produced no bundle");
      return { "ui.sandbox.js": js, "ui.css": css };
    },
  };
}

export function catalogPort(opts: { home: string; components: LiveComponents }): ComponentCatalog {
  const { registry, publisher, usageChanged } = opts.components;
  const sourceDir = (id: string) => join(draftsDir(opts.home), id);
  return {
    entries: () => catalogEntries(registry.list()),
    latest: (id) => latestPublished(registry.list(), id),
    usages: (id) => usagesOf(registry.list(), id),
    sourceDir,
    isTaken: (id) => isBuiltinId(id) || registry.list().some((c) => c.id === id) || existsSync(sourceDir(id)),
    async publish(input) {
      const result = await publisher.publish(input.id, input.strategy, { origin: input.origin });
      usageChanged();
      return result;
    },
    async approve(input) {
      const version = await registry.approve(input.id, input.version, input.hash, input.trust);
      usageChanged();
      return version;
    },
  };
}

export function projectsPort(docs: Docs): ProjectAccess {
  return {
    pageExists: (projectId, pageId) =>
      docs.projectIds().includes(projectId) &&
      listPages(docs.project(projectId)).some((p) => p.id === pageId),
    addInstance: async (projectId, pageId, ref) =>
      Instance.parse(docs.run(projectId, { method: "addInstance", pageId, component: ref }, USER_COMMAND)),
  };
}

export function differPort(env: Record<string, string | undefined>, cwd: string): Differ {
  const git = env.KIBO_GIT ?? "git";
  return async ({ path, before, after }) => {
    const argv = [
      git,
      "diff",
      "--no-index",
      ...DIFF_FLAGS,
      "--",
      before ?? "/dev/null",
      after ?? "/dev/null",
    ];
    const r = await run(argv, { cwd });
    if (r.code > 1) throw new KiboError("GIT_FAILED", `git diff: ${r.stderr.split("\n")[0] ?? ""}`);
    return { ...parseDiff(r.stdout, path, null), hunkStaging: false };
  };
}
