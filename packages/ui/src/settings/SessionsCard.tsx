import type { SessionInfo } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { useState } from "react";
import { client } from "../api";
import { frSecurity } from "../i18n/fr-security";
import { relativeTime } from "../lib/relative-time";
import { securityFailure } from "../lib/security-error";
import { useRpcQuery } from "../state/use-rpc-query";

const t = frSecurity.sessions;
const HEAD = "h-9 px-3 text-2xs font-normal text-muted-foreground";
const CELL = "px-3 py-2.5";
const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const date = (ms: number) => day.format(new Date(ms));

function SessionRow({ session, onRevoke }: { session: SessionInfo; onRevoke(id: string): void }) {
  return (
    <TableRow>
      <TableCell className={CELL}>
        <span className="flex items-center gap-2">
          {session.deviceName}
          {session.current && (
            <Badge variant="secondary" className="text-2xs">
              {t.current}
            </Badge>
          )}
        </span>
      </TableCell>
      <TableCell className={CELL}>{session.remote ? t.remote : t.local}</TableCell>
      <TableCell className={CELL}>{date(session.createdAt)}</TableCell>
      <TableCell className={CELL}>{relativeTime(session.lastSeenAt)}</TableCell>
      <TableCell className={CELL}>{date(session.expiresAt)}</TableCell>
      <TableCell className={`${CELL} py-1.5 text-right`}>
        {!session.current && (
          <Button variant="ghost" size="sm" onClick={() => onRevoke(session.id)}>
            {t.revoke}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function SessionsCard() {
  const {
    data: sessions,
    error: loadError,
    reload,
  } = useRpcQuery({ method: "listSessions" }, ["sessions.changed"]);
  const [error, setError] = useState<string | null>(null);
  const revoke = async (id: string) => {
    setError(null);
    try {
      await client.rpc({ method: "revokeSession", id });
    } catch (e) {
      setError(securityFailure(e));
    }
    reload();
  };
  const failure = error ?? (loadError ? securityFailure(loadError) : null);
  return (
    <Card className="gap-4">
      <CardHeader className="flex items-baseline gap-2">
        <CardTitle>{t.title}</CardTitle>
        <CardDescription className="text-xs">{t.help}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        {sessions?.length === 0 && <p className="text-sm text-muted-foreground">{t.empty}</p>}
        {sessions && sessions.length > 0 && (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={HEAD}>{t.device}</TableHead>
                  <TableHead className={HEAD}>{t.type}</TableHead>
                  <TableHead className={HEAD}>{t.created}</TableHead>
                  <TableHead className={HEAD}>{t.lastSeen}</TableHead>
                  <TableHead className={HEAD}>{t.expires}</TableHead>
                  <TableHead className={`${HEAD} w-24`} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <SessionRow key={s.id} session={s} onRevoke={revoke} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
