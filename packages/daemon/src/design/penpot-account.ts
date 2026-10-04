import { type IntegrationStatus, KiboError, PenpotInstanceUrl } from "@kibo/schema";
import type { EventLog } from "../integrations/events";
import { isLoopbackHost } from "../integrations/net";
import { baseStatus } from "../integrations/probes";
import type { Redactor } from "../integrations/redact";
import type { Settings } from "../integrations/settings";
import type { SecretStore } from "../integrations/types";
import { connectedStatus, errorOf, type LastError, secretStatus } from "./account-status";
import type { PenpotClient } from "./providers/penpot";

export type PenpotAccount = {
  instance(): string | null;
  token(): Promise<string | null>;
  status(): Promise<IntegrationStatus>;
  connect(url: string, token: string): Promise<IntegrationStatus>;
  test(): Promise<IntegrationStatus>;
  disconnect(): Promise<void>;
};

function instanceOf(raw: string): string {
  if (!PenpotInstanceUrl.safeParse(raw).success)
    throw new KiboError("INVALID_INPUT", "penpot instance must be https, or http on loopback");
  const u = new URL(raw);
  if (u.protocol === "https:" && isLoopbackHost(u.hostname))
    throw new KiboError("INVALID_INPUT", "https on a loopback instance is not supported");
  return u.origin;
}

export function createPenpotAccount(deps: {
  settings: Settings;
  secrets: SecretStore;
  redactor: Redactor;
  penpot: PenpotClient;
  events: EventLog;
}): PenpotAccount {
  const { settings, secrets, events } = deps;
  let lastError: LastError = null;
  const instance = () => settings.get("penpot.url");
  const accountLabel = () => {
    const url = instance();
    const name = settings.get("penpot.account");
    return url === null || name === null ? null : `${name} · ${new URL(url).host}`;
  };
  const account: PenpotAccount = {
    instance,
    token: async () => (instance() === null ? null : secrets.get("penpot")),
    async status() {
      if (instance() === null) return baseStatus("penpot", "disconnected");
      return (await secretStatus("penpot", secrets)) ?? connectedStatus("penpot", accountLabel(), lastError);
    },
    async connect(url, token) {
      const origin = instanceOf(url);
      deps.redactor.add(token);
      const profile = await deps.penpot.profile(origin, token);
      await secrets.set("penpot", token);
      settings.set("penpot.url", origin);
      settings.set("penpot.account", profile.fullname);
      lastError = null;
      events.log("penpot", "info", `connected to ${origin}`);
      return account.status();
    },
    async test() {
      const url = instance();
      if (url === null) return account.status();
      try {
        const token = await account.token();
        if (!token) throw new KiboError("NOT_CONNECTED", "penpot token is missing");
        settings.set("penpot.account", (await deps.penpot.profile(url, token)).fullname);
        lastError = null;
      } catch (e) {
        lastError = errorOf(e);
      }
      return account.status();
    },
    async disconnect() {
      await secrets.delete("penpot");
      settings.delete("penpot.url");
      settings.delete("penpot.account");
      lastError = null;
      events.log("penpot", "info", "disconnected");
    },
  };
  return account;
}
