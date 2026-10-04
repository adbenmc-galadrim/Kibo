import { KiboError } from "@kibo/schema";
import type { IntegrationKit, IntegrationModule } from "../integrations/bootstrap";
import type { McpHub } from "../mcp/hub";
import { createFigma } from "./figma";

export function figmaModule(kit: IntegrationKit, hub: McpHub): IntegrationModule {
  const figma = createFigma({ host: kit.host, hub, settings: kit.settings, events: kit.events });
  figma
    .start()
    .catch((e) =>
      kit.events.log("figma", "error", `start failed: ${e instanceof KiboError ? e.detail : String(e)}`),
    );
  return {
    handlers: {
      connectFigma: (req) =>
        req.auth.mode === "mcp"
          ? figma.configure(req.auth.url)
          : Promise.reject(new KiboError("INVALID_INPUT", "token mode arrives with T5")),
      linkDesignFrame: (req) => figma.link(req.projectId, req.ticketId, req.url),
      getDesignFrame: async () => {
        throw new KiboError("INTERNAL", "replaced by T6");
      },
    },
    probes: [
      {
        id: "figma",
        status: async () => figma.status(),
        test: () => figma.test(),
        async disconnect() {
          await figma.disconnect();
          kit.host.broadcast({ type: "integrations" });
        },
      },
    ],
  };
}
