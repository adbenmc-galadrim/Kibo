import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { useId } from "react";
import { frMachine as t } from "../i18n/fr-machine";
import { abbreviateHome } from "../lib/home-path";
import { useRpcQuery } from "../state/use-rpc-query";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-sm">{value}</dd>
    </div>
  );
}

export function MachineCard() {
  const titleId = useId();
  const env = useRpcQuery({ method: "getEnvironment" }, []).data;
  return (
    <Card role="region" aria-labelledby={titleId} className="gap-4">
      <CardHeader>
        <CardTitle id={titleId}>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {env === null ? (
          <p className="text-sm text-muted-foreground">{t.loading}</p>
        ) : (
          <dl className="grid gap-3">
            <Row
              label={t.daemon}
              value={t.daemonDetail(env.daemon.address, abbreviateHome(env.daemon.home))}
            />
            <Row
              label={t.capacity}
              value={t.capacityDetail(env.capacity.cores, env.capacity.ramGb, env.capacity.hostSlots)}
            />
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
