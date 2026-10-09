import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { useState } from "react";
import { frSecurity } from "../i18n/fr-security";
import { PairingCodeDialog } from "./PairingCodeDialog";

const t = frSecurity.webAccess;

export function WebAccessCard() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4 text-sm">
        <p className="text-xs text-muted-foreground">{t.help}</p>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {t.generate}
        </Button>
        {open && <PairingCodeDialog open onOpenChange={setOpen} />}
      </CardContent>
    </Card>
  );
}
