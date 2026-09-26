import { useEntities, useSdk } from "@kibo/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";

export function Component() {
  const sdk = useSdk();
  const tickets = useEntities("ticket");
  return (
    <Card className="h-full bg-emerald-500">
      <CardHeader>
        <CardTitle>Hello {sdk.viewer}</CardTitle>
      </CardHeader>
      <CardContent>{tickets.data.length} tickets</CardContent>
    </Card>
  );
}
