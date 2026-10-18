import { useSdk } from "@kibo/sdk";
import { useEffect, useState } from "react";

export function useProjectClient(): string | null {
  const sdk = useSdk();
  const [client, setClient] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      sdk.project.get().then(
        (info) => {
          if (alive) setClient(info.client);
        },
        (e: unknown) => console.warn("[questions] project info unavailable", e),
      );
    void load();
    const stop = sdk.project.subscribe(() => void load());
    return () => {
      alive = false;
      stop();
    };
  }, [sdk]);
  return client;
}
