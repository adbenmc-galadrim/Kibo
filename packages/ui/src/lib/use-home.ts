import { useEffect, useState } from "react";
import { client } from "../api";

export type UserHome = string | null | undefined;

export function useHome(): UserHome {
  const [home, setHome] = useState<UserHome>(undefined);
  useEffect(() => {
    let alive = true;
    client.rpc({ method: "getAppInfo" }).then(
      (info) => alive && setHome(info?.userHome ?? null),
      () => alive && setHome(null),
    );
    return () => {
      alive = false;
    };
  }, []);
  return home;
}
