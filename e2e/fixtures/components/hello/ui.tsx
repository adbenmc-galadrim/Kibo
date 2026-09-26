import { useEntities, useSdk } from "@kibo/sdk";
import manifest from "./kibo.component.json";

export function Component() {
  const sdk = useSdk();
  const tickets = useEntities("ticket");
  return (
    <div className="grid gap-1 p-4 text-sm">
      <p className="font-medium">Hello {sdk.viewer}</p>
      <p className="text-muted-foreground">Version {manifest.version}</p>
      <p>{tickets.data.length} tickets</p>
    </div>
  );
}
