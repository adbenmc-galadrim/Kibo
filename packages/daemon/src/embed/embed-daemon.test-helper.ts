import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type { ComponentCall, RpcRequest } from "@kibo/schema";
import { z } from "zod";
import { type Client, pair } from "../components/exit.test-helper";
import { okReport } from "../components/service.test-helper";
import { type Daemon, startDaemon } from "../daemon";
import { parseIntegrationFlags } from "../integrations/bootstrap";

const Id = z.object({ id: z.string() });

export type EmbedDaemon = {
  home: string;
  daemon: Daemon;
  client: Client;
  project(folder: string | null): Promise<string>;
  widget(projectId: string, component: string, config?: Record<string, unknown>): Promise<string>;
  call(projectId: string, instanceId: string, call: ComponentCall): RpcRequest;
  stop(): Promise<void>;
};

export async function bootEmbedDaemon(testOrigins: string): Promise<EmbedDaemon> {
  const home = mkdtempSync(join(tmpdir(), "kibo-embed-int-"));
  const daemon = await startDaemon({
    home,
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    validate: okReport,
    integrations: parseIntegrationFlags({ "test-origins": testOrigins, "memory-secrets": true }),
  });
  const client = await pair(daemon);
  const command = async (projectId: string, cmd: Extract<RpcRequest, { method: "command" }>["command"]) =>
    Id.parse(await client.ok({ method: "command", projectId, command: cmd })).id;
  return {
    home,
    daemon,
    client,
    async project(folder) {
      const created = await client.ok({
        method: "createProject",
        name: "Kibo",
        key: "KIB",
        folder,
        color: "#71717A",
      });
      return Id.parse(created).id;
    },
    async widget(projectId, component, config) {
      const pageId = await command(projectId, { method: "addPage", title: "Jeux", kind: "dashboard" });
      return command(projectId, { method: "addInstance", pageId, component, ...(config && { config }) });
    },
    call: (projectId, instanceId, call) => ({ method: "componentCall", projectId, instanceId, call }),
    async stop() {
      await daemon.stop();
      rmSync(home, { recursive: true, force: true });
    },
  };
}
