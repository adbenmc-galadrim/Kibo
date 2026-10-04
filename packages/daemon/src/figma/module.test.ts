import { expect, test } from "bun:test";
import { parseIntegrationFlags, startIntegrations } from "../integrations/bootstrap";
import { createRedactor } from "../integrations/redact";
import { createFakeHost } from "../integrations/testing/fake-host";
import { startFakeFigma } from "../testing/fake-figma";
import { startFakeMcpHttp } from "../testing/fake-mcp";

const NODE_URL = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34";
const SECRET = "figd_TESTSECRET";

test("the daemon connects figma by token or mcp and links a node", async () => {
  const server = await startFakeMcpHttp();
  const figma = startFakeFigma({ token: SECRET, handle: "adam" });
  figma.addFile("AbC123xyz", "Kibo");
  figma.addNode("AbC123xyz", "12:34", { name: "Tickets" });
  const host = createFakeHost();
  const flags = parseIntegrationFlags({
    "test-origins": `api.figma.com=${figma.url}`,
    "memory-secrets": true,
  });
  const rpc = startIntegrations(host, flags, createRedactor());
  try {
    const figmaIs = async (state: string, account: string | null) =>
      expect(await rpc.handle({ method: "listIntegrations" })).toContainEqual(
        expect.objectContaining({ id: "figma", state, account }),
      );
    await figmaIs("disconnected", null);
    const t = host.command(
      host.projectId,
      { method: "createTicket", title: "Arbre" },
      { origin: "user", instanceId: null },
    );
    const link = () =>
      rpc.handle({ method: "linkDesignFrame", projectId: host.projectId, ticketId: t.id, url: NODE_URL });
    await expect(link()).rejects.toMatchObject({ code: "NOT_CONNECTED" });
    await rpc.handle({ method: "connectFigma", auth: { mode: "token", token: SECRET } });
    await figmaIs("connected", "adam");
    expect(await link()).toMatchObject({ kind: "figma_node", nodeId: "12:34", name: "Tickets" });
    await rpc.handle({ method: "connectFigma", auth: { mode: "mcp", url: server.url } });
    await figmaIs("connected", null);
    expect(await link()).toMatchObject({ name: "Kibo › Tickets / Arbre" });
    await rpc.handle({ method: "disconnectIntegration", id: "figma" });
    await figmaIs("disconnected", null);
    expect(host.events).toContainEqual({ type: "integrations" });
  } finally {
    await rpc.stop();
    await server.stop();
    figma.stop();
    host.close();
  }
});
