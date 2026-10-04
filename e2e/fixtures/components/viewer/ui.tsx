import { useSdk } from "@kibo/sdk";
import { useEffect, useState } from "react";

export function Component() {
  const sdk = useSdk();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    sdk.capability("gamepad");
    let live = true;
    sdk.assets.list().then(
      (list) => live && setCount(list.length),
      (e: unknown) => console.error(e),
    );
    return () => {
      live = false;
    };
  }, [sdk]);
  return <p className="p-4 text-sm">{count === null ? "…" : `${count} fichiers`}</p>;
}
