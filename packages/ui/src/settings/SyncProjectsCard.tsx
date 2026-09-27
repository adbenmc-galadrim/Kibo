import type { SyncProjectStatus, SyncStatus } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { fr } from "../i18n/fr";
import { relativeTime } from "../lib/relative-time";
import { isSuspended, syncErrorText } from "../lib/sync-errors";

const t = fr.sync;
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
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", failed ? "bg-red-500" : "bg-green-500")}
        />
        <span className={failed ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>{label}</span>
      </span>
      {hint && <span className="pl-3 text-2xs text-muted-foreground">{hint}</span>}
    </span>
  );
}

type Props = { status: SyncStatus; colors: ReadonlyMap<string, string> };

export function SyncProjectsCard({ status, colors }: Props) {
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
                  <TableHead className={`${HEAD} w-36`}>{t.role}</TableHead>
                  <TableHead className={`${HEAD} w-36`}>{t.lastSync}</TableHead>
                  <TableHead className={`${HEAD} w-64`}>{t.state}</TableHead>
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
