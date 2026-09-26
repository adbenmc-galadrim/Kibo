import { Button } from "@kibo/sdk/ui/button";
import { Bell } from "lucide-react";
import { useState } from "react";
import { fr } from "../i18n/fr";

const initial = (): NotificationPermission =>
  typeof Notification === "undefined" ? "denied" : Notification.permission;

export function NotifyButton() {
  const [permission, setPermission] = useState<NotificationPermission>(initial);
  if (permission !== "default") return <Bell aria-hidden className="size-4 text-muted-foreground" />;
  const ask = () => void Notification.requestPermission().then(setPermission, () => setPermission("denied"));
  return (
    <Button size="icon" variant="ghost" className="size-7" aria-label={fr.notify.enable} onClick={ask}>
      <Bell />
    </Button>
  );
}
