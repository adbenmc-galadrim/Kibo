import { type ExternalRef, KiboError, parseDesignUrl } from "@kibo/schema";
import { createFigmaAccount } from "../design/figma-account";
import { createFigmaMcp } from "../design/providers/figma-mcp";
import { createFigmaRest } from "../design/providers/figma-rest";
import type { IntegrationKit, IntegrationModule } from "../integrations/bootstrap";
import type { McpHub } from "../mcp/hub";

const USER = { origin: "user", instanceId: null } as const;

export function figmaModule(kit: IntegrationKit, hub: McpHub): IntegrationModule {
  const rest = createFigmaRest({
    fetch: kit.net.fetch,
    token: () => account.token(),
    redactor: kit.redactor,
    now: kit.host.now,
  });
  const mcp = createFigmaMcp({ hub, configured: () => account.mode() === "mcp" });
  const account = createFigmaAccount({
    settings: kit.settings,
    secrets: kit.secrets,
    redactor: kit.redactor,
    hub,
    rest,
    mcp,
    events: kit.events,
  });
  account
    .start()
    .catch((e) =>
      kit.events.log("figma", "error", `start failed: ${e instanceof KiboError ? e.detail : String(e)}`),
    );
  const link = async (projectId: string, ticketId: string, raw: string): Promise<ExternalRef> => {
    const parsed = parseDesignUrl(raw);
    if (parsed?.key.provider !== "figma") throw new KiboError("INVALID_INPUT", "not a figma node url");
    const provider = account.mode() === "token" ? rest : mcp;
    if (!(await provider.connected())) throw new KiboError("NOT_CONNECTED", "figma is not configured");
    const meta = await provider.metadata(parsed.key);
    const { fileKey, nodeId } = parsed.key;
    const ref: ExternalRef = {
      kind: "figma_node",
      fileKey,
      nodeId,
      url: parsed.url,
      name: meta.name.slice(0, 200),
    };
    kit.host.command(projectId, { method: "upsertExternalRef", ticketId, ref }, USER);
    return ref;
  };
  return {
    handlers: {
      async connectFigma(req) {
        const status = await account.connect(req.auth);
        kit.host.broadcast({ type: "integrations" });
        return status;
      },
      linkDesignFrame: (req) => link(req.projectId, req.ticketId, req.url),
      getDesignFrame: async () => {
        throw new KiboError("INTERNAL", "replaced by T6");
      },
    },
    probes: [
      {
        id: "figma",
        status: () => account.status(),
        test: () => account.test(),
        async disconnect() {
          await account.disconnect();
          kit.host.broadcast({ type: "integrations" });
        },
      },
    ],
  };
}
