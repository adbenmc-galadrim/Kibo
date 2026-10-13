import type {
  AutoLinkReason,
  CodeImport,
  IndexedFile,
  Overlap,
  WorkspaceIndex,
  WorkspaceRun,
} from "@kibo/schema";
import { isCodePath } from "./ignore";
import { isRelativeSpec } from "./imports";
import { startedFirst } from "./roles";

export type ImportProbe = (
  fromPath: string,
  spec: string,
) => { path: string; added: boolean; exports: string[] } | null;

export type LinkEnd = { workspace: string; runId: string };

export type LinkProposal = {
  from: LinkEnd;
  to: LinkEnd;
  reason: AutoLinkReason;
  path: string;
  name: string | null;
};

type Found = { reason: AutoLinkReason; path: string; name: string | null };

const missingModule = (imp: CodeImport, fromPath: string, probeA: ImportProbe): Found[] => {
  const found = probeA(fromPath, imp.spec);
  if (!found?.added) return [];
  const name = imp.names.find((n) => found.exports.includes(n)) ?? imp.names[0] ?? null;
  return [{ reason: "import", path: found.path, name }];
};

const missingNames = (
  imp: CodeImport,
  module: { path: string; exports: string[] },
  a: WorkspaceIndex,
): Found[] =>
  imp.names
    .filter((name) => !module.exports.includes(name))
    .filter((name) => a.files.some((f) => f.path === module.path && f.exports.includes(name)))
    .map((name) => ({ reason: "import", path: module.path, name }));

const importLinks = (
  a: WorkspaceIndex,
  b: WorkspaceIndex,
  probes: { a: ImportProbe; b: ImportProbe },
): Found[] =>
  b.files
    .filter((file) => isCodePath(file.path))
    .flatMap((file) =>
      file.imports
        .filter((imp) => isRelativeSpec(imp.spec))
        .flatMap((imp) => {
          const inB = probes.b(file.path, imp.spec);
          return inB === null ? missingModule(imp, file.path, probes.a) : missingNames(imp, inB, a);
        }),
    );

const isBetween = (o: Overlap, a: string, b: string): boolean =>
  (o.ownerWorkspace === a && o.otherWorkspace === b) || (o.ownerWorkspace === b && o.otherWorkspace === a);

const ownsTheCode = (
  a: WorkspaceIndex,
  b: WorkspaceIndex,
  resolved: readonly Overlap[],
  runs: { a: WorkspaceRun; b: WorkspaceRun },
): boolean => {
  const settled = resolved.filter(
    (o) => o.status === "resolved" && o.kind !== "file" && isBetween(o, a.key, b.key),
  );
  if (settled.length === 0) return startedFirst(runs.a, runs.b);
  return settled.some((o) => o.ownerWorkspace === a.key);
};

const isAddedCopy = (ours: IndexedFile | undefined, theirs: IndexedFile): boolean =>
  ours !== undefined &&
  ours.status === "added" &&
  theirs.status === "added" &&
  theirs.hash !== null &&
  ours.hash === theirs.hash;

const copyLinks = (
  a: WorkspaceIndex,
  b: WorkspaceIndex,
  resolved: readonly Overlap[],
  runs: { a: WorkspaceRun; b: WorkspaceRun },
): Found[] => {
  const ours = new Map(a.files.map((f) => [f.path, f]));
  const copies = b.files.filter((theirs) => isAddedCopy(ours.get(theirs.path), theirs));
  if (copies.length === 0 || !ownsTheCode(a, b, resolved, runs)) return [];
  return copies.map((f) => ({ reason: "copy", path: f.path, name: null }));
};

export function autoLinkRule(
  a: WorkspaceIndex,
  b: WorkspaceIndex,
  probes: { a: ImportProbe; b: ImportProbe },
  resolved: readonly Overlap[],
  runs: { a: WorkspaceRun; b: WorkspaceRun },
): LinkProposal[] {
  if (a.key === b.key) return [];
  const from = { workspace: a.key, runId: runs.a.runId };
  const to = { workspace: b.key, runId: runs.b.runId };
  const unique = new Map<string, LinkProposal>();
  for (const found of [...importLinks(a, b, probes), ...copyLinks(a, b, resolved, runs)]) {
    const id = `${found.path}\u0000${found.name ?? ""}`;
    if (!unique.has(id)) unique.set(id, { from, to, ...found });
  }
  return [...unique.values()];
}
