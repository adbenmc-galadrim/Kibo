import { Button } from "@kibo/sdk/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kibo/sdk/ui/tabs";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { FileText, Folder } from "lucide-react";
import { frDomains } from "../i18n/fr-domains";
import { ExecutionGate } from "../shell/nav/ExecutionGate";
import { DomainConfirmations } from "./DomainConfirmations";
import { DomainHeader } from "./DomainHeader";
import { treeEntries } from "./domains-entries";
import { EmptyNode } from "./EmptyNode";
import { FolderTree } from "./FolderTree";
import { AddFileForm, GuidelineFiles } from "./GuidelineFiles";
import { GuidelinePreview } from "./GuidelinePreview";
import { HowAgentsAreConfigured } from "./HowAgentsAreConfigured";
import { InjectionChain } from "./InjectionChain";
import { NodeHeader } from "./NodeHeader";
import { SettingsLayout } from "./SettingsLayout";
import { type DomainsPageArgs, type DomainsPageState, useDomainsPage } from "./use-domains-page";

function folderOf(page: DomainsPageState) {
  const { tree, node } = page;
  if (node.kind === "workspace") return tree.workspace;
  return tree.projects.find((p) => p.project.id === node.projectId) ?? null;
}

function titleOf(page: DomainsPageState): string {
  if (page.domain) return frDomains.domainTitle(page.domain.name);
  return page.project ? frDomains.project(page.project.name) : frDomains.workspace;
}

function emptyText(page: DomainsPageState): { title: string; help: string } {
  if (page.domain) return { title: frDomains.emptyDomain, help: frDomains.emptyDomainHelp(page.domain.name) };
  if (page.project)
    return { title: frDomains.emptyProject, help: frDomains.emptyProjectHelp(page.project.name) };
  return { title: frDomains.emptyWorkspace, help: frDomains.emptyWorkspaceHelp };
}

function NodeTitle({ page }: { page: DomainsPageState }) {
  const { domain, project } = page;
  if (domain)
    return (
      <DomainHeader
        domain={domain}
        usage={page.usage}
        projects={page.usageProjects}
        scope={domain.owner.scope === "project" && project ? project : null}
        readOnly={page.locked}
        onRename={(name) => page.updateDomain({ name })}
        onColor={(color) => page.updateDomain({ color })}
        onDelete={page.deleteDomain}
      />
    );
  const folder = folderOf(page);
  return (
    <NodeHeader
      project={project}
      files={folder?.files.length ?? 0}
      domains={folder?.domains.length ?? 0}
      readOnly={page.locked}
    />
  );
}

function EmptyPanel({ page }: { page: DomainsPageState }) {
  const text = emptyText(page);
  const folder = page.node.kind === "project" ? folderOf(page) : null;
  const owner = page.project?.id ?? null;
  return (
    <div className="grid gap-3 p-4">
      <EmptyNode
        icon={<FileText className="size-4" />}
        title={text.title}
        help={text.help}
        action={
          page.locked || page.adding
            ? undefined
            : { label: frDomains.addFile, primary: true, onClick: () => page.setAdding(true) }
        }
      />
      {folder && folder.domains.length === 0 && (
        <EmptyNode
          icon={<Folder className="size-4" />}
          title={frDomains.noDomain}
          action={
            page.locked
              ? undefined
              : { label: frDomains.newDomain, primary: false, onClick: () => page.startCreating(owner) }
          }
        />
      )}
    </div>
  );
}

function Editor({ page }: { page: DomainsPageState }) {
  const { selected } = page;
  if (!selected) return null;
  return (
    <>
      <Textarea
        aria-label={frDomains.content(selected.path)}
        value={page.content}
        readOnly={page.locked}
        onChange={(e) => page.edit(e.target.value)}
        className="min-h-[18rem] flex-1 resize-none rounded-md bg-background p-3 font-mono text-xs leading-5 md:text-xs"
      />
      <div className="flex items-center gap-2">
        {!page.locked && (
          <>
            <Button size="sm" disabled={!page.dirty} onClick={() => void page.save()}>
              {frDomains.save}
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={page.removeFile}>
              {frDomains.removeFile}
            </Button>
          </>
        )}
        <span className="flex-1" />
        {page.domain?.owner.scope === "workspace" && (
          <span className="text-xs text-muted-foreground">{frDomains.appliesToLocal}</span>
        )}
      </div>
    </>
  );
}

export function DomainsPage(props: DomainsPageArgs) {
  const page = useDomainsPage(props);
  const title = titleOf(page);
  const hasFiles = page.files.length > 0;
  return (
    <SettingsLayout active="domains">
      <div className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{frDomains.title}</h1>
          <p className="text-sm text-muted-foreground">{frDomains.subtitle}</p>
        </div>
        <ExecutionGate>
          <HowAgentsAreConfigured />
        </ExecutionGate>
        <div className="grid min-h-[32rem] grid-cols-[18rem_1fr] items-start gap-4">
          <nav aria-label={frDomains.folders} className="grid gap-1 rounded-lg border bg-card p-2">
            <p className="px-2 pt-1 text-3xs font-medium uppercase tracking-wide text-muted-foreground">
              {frDomains.folders}
            </p>
            <FolderTree
              label={frDomains.folders}
              entries={treeEntries(page)}
              selected={page.treeSelected}
              expanded={page.expanded}
              onToggle={page.toggle}
            />
          </nav>
          <section aria-label={title} className="flex min-w-0 flex-col rounded-lg border bg-card">
            <Tabs defaultValue="edit" className="flex flex-1 flex-col gap-0">
              <header className="flex items-center gap-3 border-b px-4 py-3">
                <NodeTitle page={page} />
                {hasFiles && (
                  <TabsList>
                    <TabsTrigger value="edit">{frDomains.edit}</TabsTrigger>
                    <TabsTrigger value="preview">{frDomains.preview}</TabsTrigger>
                  </TabsList>
                )}
              </header>
              {hasFiles && (
                <GuidelineFiles
                  title={title}
                  files={page.files}
                  selectedId={page.selected?.id ?? null}
                  canAdd={!page.locked}
                  onSelect={page.selectFile}
                  onAddStart={() => page.setAdding(true)}
                />
              )}
              {page.adding && <AddFileForm onAdd={page.addFile} />}
              {page.error && (
                <p role="alert" className="px-4 pt-3 text-sm text-destructive">
                  {page.error}
                </p>
              )}
              {hasFiles ? (
                <>
                  <TabsContent value="edit" className="flex flex-1 flex-col gap-2 p-4">
                    <Editor page={page} />
                  </TabsContent>
                  <TabsContent value="preview" className="flex-1 p-4">
                    <GuidelinePreview content={page.content} />
                  </TabsContent>
                </>
              ) : (
                <EmptyPanel page={page} />
              )}
              <InjectionChain labels={page.chainLabels} tokens={page.tokens} />
            </Tabs>
          </section>
        </div>
      </div>
      <DomainConfirmations
        confirming={page.confirming}
        domain={page.domain}
        files={page.files.length}
        onClose={page.closeConfirm}
        onDeleteDomain={page.confirmDeleteDomain}
        onRemoveFile={page.confirmRemoveFile}
      />
    </SettingsLayout>
  );
}
