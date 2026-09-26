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
      configureFigma: (req) => figma.configure(req.url),
      linkFigmaNode: (req) => figma.link(req.projectId, req.ticketId, req.url),
      getFigmaPreview: (req) => figma.preview(req.fileKey, req.nodeId),
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
