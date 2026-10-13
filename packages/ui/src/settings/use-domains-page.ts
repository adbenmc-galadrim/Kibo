import {
  type ConfigCommand,
  DOMAIN_COLORS,
  Domain,
  estimateTokens,
  GuidelinePath,
  KiboError,
  type ProjectSnapshot,
  type ProjectSummary,
  type WorkspaceConfig,
} from "@kibo/schema";
import { useMemo, useState } from "react";
import { client } from "../api";
import { frDomains } from "../i18n/fr-domains";
import type { DomainConfirming } from "./DomainConfirmations";
import {
  buildTree,
  chainOf,
  domainOwnerProject,
  domainRef,
  filesOf,
  findDomain,
  type NodeRef,
  nodeKey,
  ownerOf,
  WORKSPACE_NODE,
} from "./domains-tree";

export type DomainsPageArgs = {
  config: WorkspaceConfig;
  projects: ProjectSummary[];
  snapshots?: ReadonlyMap<string, ProjectSnapshot>;
  projectId?: string | null;
  currentProjectId?: string | null;
};

type Sent = { ok: true; result: unknown } | { ok: false };

export const groupKey = (projectId: string | null) => `domains:${projectId ?? ""}`;
export const fileKey = (ref: NodeRef, guidelineId: string) => `file:${nodeKey(ref)}:${guidelineId}`;

const projectNode = (projectId: string): NodeRef => ({ kind: "project", projectId });
const nodeProject = (ref: NodeRef) => (ref.kind === "workspace" ? null : ref.projectId);
const openedFor = (projectId: string | null) => [
  nodeKey(WORKSPACE_NODE),
  groupKey(null),
  ...(projectId ? [nodeKey(projectNode(projectId)), groupKey(projectId)] : []),
];

function readOnlyProjects(projects: ProjectSummary[], snapshots?: ReadonlyMap<string, ProjectSnapshot>) {
  const access = (id: string) => snapshots?.get(id)?.sync.access ?? "write";
  return new Set(projects.filter((p) => access(p.id) !== "write").map((p) => p.id));
}

function projectsUsing(domain: Domain, snapshots?: ReadonlyMap<string, ProjectSnapshot>): number {
  const owner = domainOwnerProject(domain);
  return [...(snapshots?.values() ?? [])]
    .filter((s) => owner === null || s.meta.id === owner)
    .filter((s) => s.tickets.some((t) => t.domainId === domain.id)).length;
}

export function useDomainsPage(args: DomainsPageArgs) {
  const { config, projects, snapshots, projectId = null, currentProjectId = null } = args;
  const readOnly = useMemo(() => readOnlyProjects(projects, snapshots), [projects, snapshots]);
  const tree = buildTree(config, projects, projectId ?? currentProjectId, readOnly);
  const [node, setNode] = useState<NodeRef>(projectId ? projectNode(projectId) : WORKSPACE_NODE);
  const [fileId, setFileId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(openedFor(projectId)));
  const [aimed, setAimed] = useState(projectId);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<DomainConfirming | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const expand = (...keys: string[]) => setExpanded((s) => new Set([...s, ...keys]));
  const toggle = (key: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const pick = (ref: NodeRef, file: string | null = null) => {
    setNode(ref);
    setFileId(file);
    setError(null);
    setAdding(false);
    if (ref.kind === "project") expand(nodeKey(ref), groupKey(ref.projectId));
  };
  if (projectId !== aimed) {
    setAimed(projectId);
    if (projectId) pick(projectNode(projectId));
  }

  const ownerProjectId = nodeProject(node);
  const project = projects.find((p) => p.id === ownerProjectId) ?? null;
  const domain = findDomain(config, node);
  const files = filesOf(config, node);
  const selected = files.find((g) => g.id === fileId) ?? files[0] ?? null;
  const draftKey = selected ? fileKey(node, selected.id) : "";
  const content = selected ? (drafts[draftKey] ?? selected.content) : "";
  const dirty = selected !== null && content !== selected.content;
  const locked = ownerProjectId !== null && readOnly.has(ownerProjectId);
  const chain = chainOf(node);
  const tokens = chain
    .flatMap((ref) => filesOf(config, ref))
    .reduce((n, g) => n + estimateTokens(g.content), 0);
  const nameOf = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "";
  const chainLabels = chain.map((ref) => {
    if (ref.kind === "workspace") return frDomains.chainWorkspace;
    if (ref.kind === "project") return frDomains.chainProject(nameOf(ref.projectId));
    return frDomains.chainDomain(domain?.name ?? "");
  });

  const send = async (command: ConfigCommand, invalid: string = frDomains.failed): Promise<Sent> => {
    setError(null);
    try {
      return { ok: true, result: await client.rpc({ method: "config", command }) };
    } catch (e) {
      setError(e instanceof KiboError && e.code === "INVALID_INPUT" ? invalid : frDomains.failed);
      return { ok: false };
    }
  };

  const save = async () => {
    if (!selected) return;
    const done = await send({
      method: "updateGuideline",
      owner: ownerOf(node),
      guidelineId: selected.id,
      content,
    });
    if (done.ok) setDrafts(({ [draftKey]: _, ...rest }) => rest);
  };
  const edit = (value: string) => setDrafts((d) => ({ ...d, [draftKey]: value }));
  const addFile = async (path: string) => {
    const parsed = GuidelinePath.safeParse(path);
    if (!parsed.success) {
      setError(frDomains.invalidPath);
      return false;
    }
    const done = await send({ method: "addGuideline", owner: ownerOf(node), path: parsed.data, content: "" });
    if (done.ok) setAdding(false);
    return done.ok;
  };
  const removeFile = () => {
    if (selected) setConfirming({ kind: "file", path: selected.path, guidelineId: selected.id });
  };
  const confirmRemoveFile = async (guidelineId: string) => {
    await client.rpc({
      method: "config",
      command: { method: "removeGuideline", owner: ownerOf(node), guidelineId },
    });
  };

  const startCreating = (owner: string | null) => {
    expand(owner ? nodeKey(projectNode(owner)) : nodeKey(WORKSPACE_NODE), groupKey(owner));
    setCreating(groupKey(owner));
  };
  const createDomain = async (owner: string | null, name: string) => {
    const scoped = config.domains.filter((d) => domainOwnerProject(d) === owner).length;
    const color = DOMAIN_COLORS[scoped % DOMAIN_COLORS.length] ?? DOMAIN_COLORS[0];
    const done = await send(
      owner
        ? { method: "createDomain", domain: { name, color }, owner: { scope: "project", projectId: owner } }
        : { method: "createDomain", domain: { name, color } },
      frDomains.duplicate,
    );
    if (!done.ok) return false;
    setCreating(null);
    const created = Domain.safeParse(done.result);
    if (created.success) pick(domainRef(created.data));
    return true;
  };
  const updateDomain = async (patch: { name?: string; color?: string }) => {
    if (!domain) return false;
    const command: ConfigCommand = {
      method: "updateDomain",
      domainId: domain.id,
      patch,
      owner: domain.owner,
    };
    return (await send(command, frDomains.duplicate)).ok;
  };
  const deleteDomain = () => {
    if (!domain) return;
    if ((config.domainUsage[domain.id] ?? 0) > 0) setError(frDomains.inUse);
    else setConfirming({ kind: "domain" });
  };
  const confirmDeleteDomain = async () => {
    if (!domain) return;
    await client.rpc({
      method: "config",
      command: { method: "deleteDomain", domainId: domain.id, owner: domain.owner },
    });
    pick(ownerProjectId ? projectNode(ownerProjectId) : WORKSPACE_NODE);
  };

  return {
    tree,
    node,
    project,
    domain,
    files,
    selected,
    content,
    dirty,
    locked,
    chainLabels,
    tokens,
    usage: domain ? (config.domainUsage[domain.id] ?? 0) : 0,
    usageProjects: domain ? projectsUsing(domain, snapshots) : 0,
    treeSelected: fileId && selected ? fileKey(node, selected.id) : nodeKey(node),
    expanded,
    error,
    confirming,
    creating,
    adding,
    toggle,
    pick,
    selectFile: setFileId,
    edit,
    save,
    setAdding,
    addFile,
    removeFile,
    confirmRemoveFile,
    startCreating,
    cancelCreating: () => setCreating(null),
    createDomain,
    updateDomain,
    deleteDomain,
    confirmDeleteDomain,
    closeConfirm: () => setConfirming(null),
  };
}

export type DomainsPageState = ReturnType<typeof useDomainsPage>;
