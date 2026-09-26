import { type IntegrationStatus, KiboError } from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";

export type IntegrationsState = {
  statuses: IntegrationStatus[];
  error: KiboError | null;
  loading: boolean;
  reload(): Promise<void>;
};

export function useIntegrations(): IntegrationsState {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [error, setError] = useState<KiboError | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      setStatuses(await client.rpc({ method: "listIntegrations" }));
      setError(null);
    } catch (e) {
      setError(e instanceof KiboError ? e : new KiboError("INTERNAL", String(e)));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    return client.subscribeIntegrations((e) => {
      if (e.type === "integrations") void reload();
    });
  }, [reload]);
  return { statuses, error, loading, reload };
}
