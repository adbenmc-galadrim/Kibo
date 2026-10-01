import { useEffect, useState } from "react";
import { fr } from "../i18n/fr";
import { KiboLogo } from "./KiboLogo";

export function LoadingScreen({ delayMs = 300 }: { delayMs?: number }) {
  const [visible, setVisible] = useState(delayMs <= 0);
  useEffect(() => {
    if (visible) return;
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, visible]);
  if (!visible) return null;
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <output className="grid justify-items-center gap-4 text-sm text-muted-foreground">
        <KiboLogo className="size-14" decorative />
        {fr.app.loading}
      </output>
    </main>
  );
}
