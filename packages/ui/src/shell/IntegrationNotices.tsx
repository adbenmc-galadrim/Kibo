import type { IntegrationEvent, Session } from "@kibo/schema";
import { Toaster } from "@kibo/sdk/ui/sonner";
import { useEffect } from "react";
import { toast } from "sonner";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { useTheme } from "../theme";

function showNotice(e: Extract<IntegrationEvent, { type: "notice" }>): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const shown = new Notification(e.title, { body: e.body });
  shown.onclick = () => window.focus();
}

export function IntegrationNotices({ notifications }: { notifications: Session["notifications"] }) {
  const theme = useTheme();
  useEffect(
    () =>
      client.subscribeIntegrations((e) => {
        if (e.type === "sync.conflict") toast(fr.integrations.conflict(e.ticketKey, e.field));
        if (e.type === "notice" && notifications === "browser") showNotice(e);
      }),
    [notifications],
  );
  return <Toaster theme={theme} position="bottom-right" />;
}
