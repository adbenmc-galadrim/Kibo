import type { ProjectSummary, SyncProjectStatus, SyncStatus } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { Ellipsis } from "lucide-react";
import { useMemo } from "react";
import { frCollab } from "../i18n/fr-collab";
import { frSyncPage } from "../i18n/fr-sync-page";
import { relativeTime } from "../lib/relative-time";
import { isSuspended, syncErrorText } from "../lib/sync-errors";

const t = frCollab.sync;
const HEAD = "h-9 px-3 text-2xs font-normal text-muted-foreground";
const CELL = "px-3 py-2.5";

function hintOf(project: SyncProjectStatus): string | null {
  if (project.accessRevoked) return null;
  if (project.lastError === "UPDATE_REJECTED") return t.rejectedHint;
  return isSuspended(project.lastError) ? t.suspendedHint : null;
}

function StateCell({ project }: { project: SyncProjectStatus }) {
  const failed = project.lastError !== null || project.accessRevoked;
  const label = project.lastError
    ? syncErrorText(t.projectErrors, project.lastError)
    : project.accessRevoked
      ? t.projectErrors.ACCESS_REVOKED
      : t.upToDate;
  const hint = hintOf(project);
  return (
    <span className="grid gap-0.5">
      <span className="flex items-start gap-1.5">
        <span
          aria-hidden
          className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", failed ? "bg-red-500" : "bg-green-500")}
        />
        <span className={failed ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>{label}</span>
      </span>
      {hint && <span className="pl-3 text-2xs text-muted-foreground">{hint}</span>}
    </span>
  );
}

type Actions = {
  onOpen(projectId: string): void;
  onManage(projectId: string): void;
  onDelete(projectId: string): void;
};

type Props = Actions & { status: SyncStatus; projects: readonly ProjectSummary[] };

export function syncProjectMenuEntries(project: SyncProjectStatus, a: Actions): MenuEntry[] {
  const id = project.projectId;
  const last: MenuEntry =
    project.role === "owner"
      ? { label: frSyncPage.stop, destructive: true, onSelect: () => a.onManage(id) }
      : { label: frSyncPage.leave, destructive: true, onSelect: () => a.onDelete(id) };
  return [
    { label: frSyncPage.open, onSelect: () => a.onOpen(id) },
    { label: frSyncPage.manage, onSelect: () => a.onManage(id) },
    last,
  ];
}

function ProjectMenu({ project, actions }: { project: SyncProjectStatus; actions: Actions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="size-7" aria-label={frSyncPage.actions(project.name)}>
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuEntries entries={syncProjectMenuEntries(project, actions)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SyncProjectsCard({ status, projects, ...actions }: Props) {
  const colors = useMemo(() => new Map(projects.map((p) => [p.id, p.color])), [projects]);
  const now = Date.now();
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{t.projects}</CardTitle>
      </CardHeader>
      <CardContent>
        {status.projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noProjects}</p>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table aria-label={t.projects}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={HEAD}>{t.project}</TableHead>
                  <TableHead className={`${HEAD} w-32`}>{t.role}</TableHead>
                  <TableHead className={`${HEAD} w-32`}>{t.lastSync}</TableHead>
                  <TableHead className={`${HEAD} w-80`}>{t.state}</TableHead>
                  <TableHead className={`${HEAD} w-12`} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {status.projects.map((p) => (
                  <TableRow key={p.projectId}>
                    <TableCell className={CELL}>
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2 rounded-full bg-muted-foreground"
                          style={{ background: colors.get(p.projectId) }}
                        />
                        {p.name}
                      </span>
                    </TableCell>
                    <TableCell className={CELL}>{t.roles[p.role]}</TableCell>
                    <TableCell className={CELL}>
                      {p.lastSyncAt === null ? t.never : relativeTime(p.lastSyncAt, now)}
                    </TableCell>
                    <TableCell className={`${CELL} whitespace-normal`}>
                      <StateCell project={p} />
                    </TableCell>
                    <TableCell className={`${CELL} py-1.5 text-right`}>
                      <ProjectMenu project={p} actions={actions} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
