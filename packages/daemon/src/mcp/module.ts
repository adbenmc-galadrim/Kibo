import type { IntegrationKit, IntegrationModule } from "../integrations/bootstrap";
import { baseStatus } from "../integrations/probes";
import { commandLineOf } from "./command-line";
import type { McpHub } from "./hub";

export function mcpModule(kit: IntegrationKit, hub: McpHub): IntegrationModule {
  const changed = () => kit.host.broadcast({ type: "integrations" });
  const status = async () => {
    const enabled = (await hub.views()).filter((v) => v.enabled);
    if (enabled.length === 0) return baseStatus("mcp", "disconnected");
    const failing = enabled.find((v) => v.state === "error");
    const servers = enabled.map((v) => v.id);
    return failing
      ? {
          ...baseStatus("mcp", "error"),
          servers,
          error: { code: "MCP_UNAVAILABLE" as const, message: `${failing.id} : ${failing.error ?? ""}` },
        }
      : { ...baseStatus("mcp", "connected"), servers };
  };
  return {
    handlers: {
      listMcpServers: () => hub.views(),
      previewMcpServer: async (req) => ({ commandLine: commandLineOf(req.server) }),
      async addMcpServer(req) {
        const view = await hub.add(req.server, req.confirmedCommandLine, req.secrets);
        changed();
        return view;
      },
      async removeMcpServer(req) {
        await hub.remove(req.id);
        changed();
        return null;
      },
      async setMcpServerEnabled(req) {
        const view = await hub.setEnabled(req.id, req.enabled);
        changed();
        return view;
      },
      async testMcpServer(req) {
        const view = await hub.test(req.id);
        changed();
        return view;
      },
    },
    probes: [
      {
        id: "mcp",
        status,
        async test() {
          for (const v of await hub.views()) if (v.enabled) await hub.test(v.id);
          return status();
        },
      },
    ],
    stop: () => hub.stop(),
  };
}
