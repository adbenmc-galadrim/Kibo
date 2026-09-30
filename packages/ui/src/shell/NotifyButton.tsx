import { Button } from "@kibo/sdk/ui/button";
import { Bell } from "lucide-react";
import { useState } from "react";
import { fr } from "../i18n/fr";

const initial = (): NotificationPermission =>
  typeof Notification === "undefined" ? "denied" : Notification.permission;

export function NotifyButton() {
  const [permission, setPermission] = useState<NotificationPermission>(initial);
  if (permission !== "default") return null;
  const ask = () => void Notification.requestPermission().then(setPermission, () => setPermission("denied"));
  return (
    <div className="-mx-1 mt-1 flex justify-end border-t px-1 pt-1">
      <Button size="sm" variant="ghost" className="h-7" onClick={ask}>
        <Bell aria-hidden />
        {fr.notify.enable}
      </Button>
    </div>
  );
}
