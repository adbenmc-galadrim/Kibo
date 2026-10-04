import { type IntegrationStatus, KiboError } from "@kibo/schema";
import type { EventLog } from "../integrations/events";
import { baseStatus } from "../integrations/probes";
import type { Redactor } from "../integrations/redact";
import type { Settings } from "../integrations/settings";
import type { SecretStore } from "../integrations/types";
import type { McpHub } from "../mcp/hub";
import { connectedStatus, errorOf, type LastError, secretStatus } from "./account-status";
import type { FigmaMcp } from "./providers/figma-mcp";
import type { FigmaRest } from "./providers/figma-rest";

export type FigmaAuth = { mode: "token"; token: string } | { mode: "mcp"; url: string };
export type FigmaAccount = {
  mode(): "token" | "mcp" | null;
  token(): Promise<string | null>;
  mcpUrl(): string | null;
  status(): Promise<IntegrationStatus>;
  connect(auth: FigmaAuth): Promise<IntegrationStatus>;
  test(): Promise<IntegrationStatus>;
  disconnect(): Promise<void>;
  start(): Promise<void>;
};

export function createFigmaAccount(deps: {
  settings: Settings;
  secrets: SecretStore;
  redactor: Redactor;
  hub: McpHub;
  rest: FigmaRest;
  mcp: FigmaMcp;
  events: EventLog;
}): FigmaAccount {
  const { settings, secrets, hub, events } = deps;
  let lastError: LastError = null;
  const mode = (): "token" | "mcp" | null => {
    const m = settings.get("figma.mode");
    if (m === "token" || m === "mcp") return m;
    return settings.get("figma.url") !== null ? "mcp" : null;
  };
  const leaveMcp = async () => {
    await hub.setReserved("figma", null);
    settings.delete("figma.url");
  };
  const connectToken = async (token: string) => {
    deps.redactor.add(token);
    const me = await deps.rest.me(token);
    await secrets.set("figma", token);
    if (mode() === "mcp") await leaveMcp();
    settings.set("figma.mode", "token");
    settings.set("figma.account", me.handle);
    events.log("figma", "info", "connected with a personal token");
  };
  const connectMcp = async (url: string) => {
    const previous = mode() === "mcp" ? settings.get("figma.url") : null;
    await hub.setReserved("figma", url);
    try {
      await deps.mcp.checkTools();
      if (mode() === "token") await secrets.delete("figma");
    } catch (e) {
      await hub.setReserved("figma", previous);
      throw e;
    }
    settings.set("figma.url", url);
    settings.set("figma.mode", "mcp");
    settings.delete("figma.account");
    events.log("figma", "info", `configured mcp server ${url}`);
  };
  const account: FigmaAccount = {
    mode,
    token: async () => (mode() === "token" ? secrets.get("figma") : null),
    mcpUrl: () => (mode() === "mcp" ? settings.get("figma.url") : null),
    async status() {
      const m = mode();
      if (m === null) return baseStatus("figma", "disconnected");
      if (m === "mcp") return connectedStatus("figma", null, lastError);
      return (
        (await secretStatus("figma", secrets)) ??
        connectedStatus("figma", settings.get("figma.account"), lastError)
      );
    },
    async connect(auth) {
      if (auth.mode === "token") await connectToken(auth.token);
      else await connectMcp(auth.url);
      lastError = null;
      return account.status();
    },
    async test() {
      const m = mode();
      try {
        if (m === "mcp") await deps.mcp.checkTools();
        if (m === "token") {
          const token = await account.token();
          if (!token) throw new KiboError("NOT_CONNECTED", "figma token is missing");
          settings.set("figma.account", (await deps.rest.me(token)).handle);
        }
        lastError = null;
      } catch (e) {
        lastError = errorOf(e);
      }
      return account.status();
    },
    async disconnect() {
      if (mode() === "token") await secrets.delete("figma");
      settings.delete("figma.mode");
      settings.delete("figma.account");
      lastError = null;
      await leaveMcp();
      events.log("figma", "info", "disconnected");
    },
    async start() {
      const url = account.mcpUrl();
      if (url !== null) await hub.setReserved("figma", url);
    },
  };
  return account;
}
