import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { PairingCodeDialog } from "./PairingCodeDialog";
import { SettingsNav } from "./SettingsNav";

const t = fr.security.appearance;

export function AppearancePage() {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid min-h-full grid-cols-[14rem_1fr]">
      <SettingsNav active="appearance" />
      <div className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>{t.daemon}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-[7rem_1fr_auto] items-center gap-4 text-sm">
            <span className="text-xs text-muted-foreground">{t.web}</span>
            <span>{t.webPair}</span>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              {t.generate}
            </Button>
          </CardContent>
        </Card>
        {open && <PairingCodeDialog open onOpenChange={setOpen} />}
      </div>
    </div>
  );
}
