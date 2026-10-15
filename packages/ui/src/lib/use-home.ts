import { useEffect, useState } from "react";
import { client } from "../api";

export function useHome(): string | null {
  const [home, setHome] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    client.rpc({ method: "getAppInfo" }).then(
      (info) => alive && setHome(info?.home ?? null),
      () => alive && setHome(null),
    );
    return () => {
      alive = false;
    };
  }, []);
  return home;
}
