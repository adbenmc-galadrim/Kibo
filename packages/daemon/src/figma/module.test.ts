import { expect, test } from "bun:test";
import { parseIntegrationFlags, startIntegrations } from "../integrations/bootstrap";
import { createRedactor } from "../integrations/redact";
import { createFakeHost } from "../integrations/testing/fake-host";
import { startFakeMcpHttp } from "../testing/fake-mcp";

const NODE_URL = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34";

test("the daemon serves figma through the integration rpc", async () => {
  const server = await startFakeMcpHttp();
  const host = createFakeHost();
  const flags = parseIntegrationFlags({
    "test-origins": "api.github.com=http://127.0.0.1:1",
    "memory-secrets": true,
  });
  const rpc = startIntegrations(host, flags, createRedactor());
  try {
    const figmaIs = async (state: string) =>
      expect(await rpc.handle({ method: "listIntegrations" })).toContainEqual(
        expect.objectContaining({ id: "figma", state }),
      );
    await figmaIs("disconnected");
    await expect(
      rpc.handle({ method: "connectFigma", auth: { mode: "token", token: "figd_x" } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await rpc.handle({ method: "connectFigma", auth: { mode: "mcp", url: server.url } });
    await figmaIs("connected");
    const t = host.command(
      host.projectId,
      { method: "createTicket", title: "Arbre" },
      { origin: "user", instanceId: null },
    );
    expect(
      await rpc.handle({
        method: "linkDesignFrame",
        projectId: host.projectId,
        ticketId: t.id,
        url: NODE_URL,
      }),
    ).toMatchObject({ kind: "figma_node", fileKey: "AbC123xyz", nodeId: "12:34" });
    await expect(
      rpc.handle({ method: "getDesignFrame", url: NODE_URL, refresh: false }),
    ).rejects.toMatchObject({
      code: "INTERNAL",
    });
    await rpc.handle({ method: "disconnectIntegration", id: "figma" });
    await figmaIs("disconnected");
    expect(host.events).toContainEqual({ type: "integrations" });
  } finally {
    await rpc.stop();
    await server.stop();
    host.close();
  }
});
