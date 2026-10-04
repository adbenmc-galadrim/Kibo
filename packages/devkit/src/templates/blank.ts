export const BLANK_UI = (title: string) => `import { useSdk } from "@kibo/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";

export function Component() {
  const sdk = useSdk();
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>${title}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col text-sm text-muted-foreground">{sdk.surface === "view" ? "Vue" : "Widget"}</CardContent>
    </Card>
  );
}
`;
