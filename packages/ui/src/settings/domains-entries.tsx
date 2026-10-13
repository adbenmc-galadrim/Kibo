import { FileText, FolderOpen, LayoutGrid, Plus } from "lucide-react";
import { frDomains } from "../i18n/fr-domains";
import {
  type DomainFolder,
  domainRef,
  type NodeRef,
  nodeKey,
  type ProjectFolder,
  WORKSPACE_NODE,
} from "./domains-tree";
import type { TreeEntry } from "./FolderTree";
import { NewDomainForm } from "./NewDomainForm";
import { type DomainsPageState, fileKey, groupKey } from "./use-domains-page";

const fileIcon = <FileText aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />;
const groupIcon = <FolderOpen aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />;
const dot = (color: string, shape: "rounded-full" | "rounded-[2px]") => (
  <span aria-hidden className={`size-2 shrink-0 ${shape}`} style={{ background: color }} />
);

function domainEntry(page: DomainsPageState, folder: DomainFolder): TreeEntry {
  const ref = domainRef(folder.domain);
  return {
    key: nodeKey(ref),
    label: folder.domain.name,
    icon: dot(folder.domain.color, "rounded-[2px]"),
    count: folder.files.length,
    onActivate: () => page.pick(ref),
  };
}

function newDomainEntry(page: DomainsPageState, owner: string | null): TreeEntry {
  const key = groupKey(owner);
  const open = page.creating === key;
  return {
    key: `new:${owner ?? ""}`,
    label: frDomains.newDomain,
    icon: <Plus aria-hidden className="size-3.5 shrink-0" />,
    muted: true,
    content: open ? (
      <NewDomainForm onCreate={(name) => page.createDomain(owner, name)} onCancel={page.cancelCreating} />
    ) : undefined,
    onActivate: () => {
      if (!open) page.startCreating(owner);
    },
  };
}

function domainsGroup(
  page: DomainsPageState,
  owner: string | null,
  domains: DomainFolder[],
  label: string,
  editable: boolean,
): TreeEntry {
  return {
    key: groupKey(owner),
    label,
    icon: groupIcon,
    onActivate: () => page.toggle(groupKey(owner)),
    children: [
      ...domains.map((d) => domainEntry(page, d)),
      ...(editable ? [newDomainEntry(page, owner)] : []),
    ],
  };
}

function projectEntry(page: DomainsPageState, folder: ProjectFolder): TreeEntry {
  const ref: NodeRef = { kind: "project", projectId: folder.project.id };
  const files: TreeEntry[] = folder.files.map((g) => ({
    key: fileKey(ref, g.id),
    label: g.path,
    icon: fileIcon,
    mono: true,
    onActivate: () => page.pick(ref, g.id),
  }));
  const empty: TreeEntry = {
    key: `empty:${folder.project.id}`,
    label: frDomains.noFileLeaf,
    icon: null,
    muted: true,
    onActivate: () => page.pick(ref),
  };
  return {
    key: nodeKey(ref),
    label: folder.project.name,
    icon: dot(folder.project.color, "rounded-full"),
    count: folder.count,
    badge: folder.readOnly ? frDomains.readOnly : undefined,
    onActivate: () => page.pick(ref),
    children: [
      ...(files.length > 0 ? files : [empty]),
      domainsGroup(page, folder.project.id, folder.domains, frDomains.projectDomains, !folder.readOnly),
    ],
  };
}

export function treeEntries(page: DomainsPageState): TreeEntry[] {
  const { workspace, projects } = page.tree;
  return [
    {
      key: nodeKey(WORKSPACE_NODE),
      label: frDomains.workspace,
      icon: <LayoutGrid aria-hidden className="size-3.5 shrink-0" />,
      count: workspace.count,
      onActivate: () => page.pick(WORKSPACE_NODE),
      children: [
        ...workspace.files.map((g) => ({
          key: fileKey(WORKSPACE_NODE, g.id),
          label: g.path,
          icon: fileIcon,
          mono: true,
          onActivate: () => page.pick(WORKSPACE_NODE, g.id),
        })),
        domainsGroup(page, null, workspace.domains, frDomains.workspaceDomains, true),
      ],
    },
    ...projects.map((p) => projectEntry(page, p)),
  ];
}
