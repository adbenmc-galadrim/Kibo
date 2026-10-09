import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Cloud } from "lucide-react";
import { frCollab } from "../i18n/fr-collab";
import { frSyncPage, SYNC_DOCS_URL } from "../i18n/fr-sync-page";

const t = frSyncPage;

type Props = { onConnect(): void; onJoinDevice(): void; remote: boolean };

type PathProps = { title: string; help: string; action: string; remote: boolean; onClick(): void };

function PathCard({ title, help, action, remote, onClick }: PathProps) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{help}</CardDescription>
      </CardHeader>
      {!remote && (
        <CardContent>
          <Button variant="outline" size="sm" onClick={onClick}>
            {action}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

export function SyncEmptyState({ onConnect, onJoinDevice, remote }: Props) {
  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Cloud aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="grid gap-1 text-sm">
          <p>{t.purpose}</p>
          <p className="text-muted-foreground">
            {t.server}{" "}
            <a
              href={SYNC_DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              {t.docs}
            </a>
          </p>
        </div>
      </div>
      {remote && <p className="text-sm text-muted-foreground">{frCollab.sync.localOnly}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <PathCard
          title={t.connectTitle}
          help={t.connectHelp}
          action={t.connect}
          remote={remote}
          onClick={onConnect}
        />
        <PathCard
          title={t.deviceTitle}
          help={t.deviceHelp}
          action={t.enterCode}
          remote={remote}
          onClick={onJoinDevice}
        />
      </div>
    </div>
  );
}
