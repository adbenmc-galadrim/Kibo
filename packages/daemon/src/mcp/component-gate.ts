import { KiboError, RESERVED_MCP_IDS } from "@kibo/schema";
import type { IntegrationHost, McpComponentGate } from "../integrations/types";
import type { McpHub } from "./hub";

function guard(server: string): void {
  if (RESERVED_MCP_IDS.some((id) => id === server))
    throw new KiboError("PERMISSION_DENIED", `mcp server ${server} is reserved`);
}

export function createMcpGate(hub: McpHub, host: IntegrationHost): McpComponentGate {
  return {
    async call(ctx, server, tool, args) {
      guard(server);
      return hub.call(server, tool, args, ctx.instanceId);
    },
    async read(ctx, server, uri) {
      guard(server);
      return hub.read(server, uri, ctx.instanceId);
    },
    async importItem(ctx, server, item) {
      guard(server);
      return host.command(
        ctx.projectId,
        {
          method: "importExternalTicket",
          title: item.title,
          ref: { kind: "mcp_item", server, itemId: item.itemId, url: item.url, title: item.title },
        },
        { origin: "user", instanceId: ctx.instanceId },
      );
    },
  };
}
