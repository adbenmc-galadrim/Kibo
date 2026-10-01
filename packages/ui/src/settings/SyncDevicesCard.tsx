import type { DeviceInfo, SyncStatus } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { Laptop, Plus } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { AddDeviceDialog } from "../dialogs/AddDeviceDialog";
import { fr } from "../i18n/fr";
import { frSyncPage } from "../i18n/fr-sync-page";
import { relativeTime } from "../lib/relative-time";
import { syncFailure } from "../lib/sync-errors";
import { useRpcQuery } from "../state/use-rpc-query";

const t = fr.sync;
const HEAD = "h-9 px-3 text-2xs font-normal text-muted-foreground";
const CELL = "px-3 py-2.5";
const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

type RowProps = { device: DeviceInfo; current: boolean; canRevoke: boolean; now: number; onRevoke(): void };

function DeviceRow({ device, current, canRevoke, now, onRevoke }: RowProps) {
  return (
    <TableRow>
      <TableCell className={CELL}>
        <span className="flex items-center gap-2">
          <Laptop aria-hidden className="size-3.5 text-muted-foreground" />
          {device.name}
          {current && (
            <Badge variant="secondary" className="text-2xs">
              {t.thisDevice}
            </Badge>
          )}
        </span>
      </TableCell>
      <TableCell className={CELL}>{day.format(new Date(device.createdAt))}</TableCell>
      <TableCell className={CELL}>
        {device.lastSeenAt === null ? t.never : relativeTime(device.lastSeenAt, now)}
      </TableCell>
      <TableCell className={`${CELL} w-28 py-1.5 text-right`}>
        {canRevoke && !current && (
          <Button variant="ghost" size="sm" onClick={onRevoke}>
            {frSyncPage.revokeAction}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function SyncDevicesCard({ status, remote }: { status: SyncStatus; remote: boolean }) {
  const {
    data: devices,
    error: loadError,
    reload,
  } = useRpcQuery({ method: "listDevices" }, ["collab.changed"]);
  const [adding, setAdding] = useState(false);
  const [revoking, setRevoking] = useState<DeviceInfo | null>(null);
  const online = status.state === "online";
  const revoke = async (deviceId: string) => {
    await client.rpc({ method: "revokeDevice", deviceId });
    reload();
  };
  const failure = loadError && online ? syncFailure(t.actionErrors, loadError) : null;
  const now = Date.now();
  const active = (devices ?? []).filter((d) => d.revokedAt === null);
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{t.devices}</CardTitle>
      </CardHeader>
      <CardContent className="grid justify-items-start gap-3">
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        {devices === null && !online && <p className="text-sm text-muted-foreground">{t.devicesOffline}</p>}
        {devices !== null && (
          <div className="w-full overflow-hidden rounded-md border">
            <Table aria-label={t.devices}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={HEAD}>{t.device}</TableHead>
                  <TableHead className={`${HEAD} w-36`}>{t.added}</TableHead>
                  <TableHead className={`${HEAD} w-36`}>{t.seen}</TableHead>
                  <TableHead className={`${HEAD} w-28`} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((d) => (
                  <DeviceRow
                    key={d.deviceId}
                    device={d}
                    current={d.deviceId === status.deviceId}
                    canRevoke={!remote && online}
                    now={now}
                    onRevoke={() => setRevoking(d)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} disabled={remote || !online}>
          <Plus aria-hidden />
          {t.addDevice}
        </Button>
      </CardContent>
      <AddDeviceDialog open={adding} onOpenChange={setAdding} serverUrl={status.serverUrl ?? ""} />
      {revoking && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRevoking(null)}
          title={frSyncPage.revokeTitle(revoking.name)}
          description={frSyncPage.revokeBody}
          confirmLabel={frSyncPage.revokeConfirm}
          cancelLabel={fr.common.cancel}
          onConfirm={() => revoke(revoking.deviceId)}
          describeError={(e) => syncFailure(t.actionErrors, e)}
        />
      )}
    </Card>
  );
}
