import { type IntegrationId, KiboError } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { useFlash } from "../lib/use-flash";
import { useIntegrations } from "../state/use-integrations";
import { DisconnectDialog, type DisconnectTarget, disconnectable } from "./DisconnectDialog";
import { IntegrationRow } from "./IntegrationRow";
import { dialogOf, INTEGRATION_DIALOGS, type IntegrationDialogId } from "./integration-dialogs";
import { integrationRow, type RowMenuItem } from "./integration-rows";
import { SettingsNav } from "./SettingsNav";

const time = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const hasDialog = (id: IntegrationId) => {
  const d = dialogOf(id);
  return d !== null && INTEGRATION_DIALOGS[d] !== undefined;
};
const message = (e: unknown) => (e instanceof KiboError ? e.detail : String(e));
const KEYCHAIN = "SECRET_STORE_UNAVAILABLE";

export function IntegrationsPage() {
  const t = fr.integrations;
  const { statuses, error, reload } = useIntegrations();
  const flash = useFlash();
  const [dialog, setDialog] = useState<IntegrationDialogId | null>(null);
  const [disconnect, setDisconnect] = useState<DisconnectTarget | null>(null);
  const keychainDown = error?.code === KEYCHAIN || statuses.some((s) => s.error?.code === KEYCHAIN);

  const test = async (id: IntegrationId) => {
    try {
      const s = await client.rpc({ method: "testIntegration", id });
      if (s.state === "error") flash.flash(s.error?.message ?? t.state.error, "error");
      else flash.flash(t.menu.tested);
    } catch (e) {
      flash.flash(message(e), "error");
    }
    await reload();
  };
  const askDisconnect = async (id: IntegrationId) => {
    const s = statuses.find((x) => x.id === id);
    if (!s || !disconnectable(s)) return;
    try {
      const opts = s.id === "github" ? await client.rpc({ method: "getGithubConnectOptions" }) : null;
      setDisconnect({ id: s.id, title: t.rows[s.id].title, mode: opts?.mode === "gh" ? "gh" : "token" });
    } catch (e) {
      flash.flash(message(e), "error");
    }
  };
  const onMenu = (id: IntegrationId, item: RowMenuItem) => {
    if (item === "test") void test(id);
    else if (item === "configure") setDialog(dialogOf(id));
    else void askDisconnect(id);
  };
  const confirmDisconnect = async (id: "github" | "figma") => {
    setDisconnect(null);
    try {
      await client.rpc({ method: "disconnectIntegration", id });
    } catch (e) {
      flash.flash(message(e), "error");
    }
    await reload();
  };
  const Dialog = dialog ? INTEGRATION_DIALOGS[dialog] : undefined;

  return (
    <div className="grid min-h-full grid-cols-[14rem_1fr]">
      <SettingsNav active="integrations" />
      <section className="flex flex-col gap-4 p-8">
        <header>
          <h1 className="text-xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </header>
        {keychainDown && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
          >
            {t.keychainUnavailable}
          </p>
        )}
        {error && !keychainDown && (
          <p role="alert" className="text-sm text-destructive">
            {error.detail}
          </p>
        )}
        {flash.message && (
          <p
            role={flash.tone === "error" ? "alert" : "status"}
            className={cn("text-sm", flash.tone === "error" ? "text-destructive" : "text-muted-foreground")}
          >
            {flash.message}
          </p>
        )}
        <ul className="grid gap-2">
          {statuses.map((s) => (
            <IntegrationRow
              key={s.id}
              row={integrationRow(s, { hasDialog, time })}
              onAction={(action) => (action === "retry" ? void test(s.id) : setDialog(dialogOf(s.id)))}
              onMenu={(item) => onMenu(s.id, item)}
            />
          ))}
        </ul>
        {Dialog && (
          <Dialog
            open
            onOpenChange={(open) => !open && setDialog(null)}
            onDone={(done) => {
              setDialog(null);
              if (done) flash.flash(done);
              void reload();
            }}
          />
        )}
        <DisconnectDialog
          target={disconnect}
          onCancel={() => setDisconnect(null)}
          onConfirm={(id) => void confirmDisconnect(id)}
        />
      </section>
    </div>
  );
}
