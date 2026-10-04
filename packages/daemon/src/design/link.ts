import { type DesignProvider, type ExternalRef, KiboError } from "@kibo/schema";
import type { IntegrationHost } from "../integrations/types";
import type { FrameService } from "./frame-service";
import { parseFrameUrl } from "./frame-url";
import type { DesignProviderClient } from "./providers/types";

export type LinkDeps = {
  host: IntegrationHost;
  service: Pick<FrameService, "metadata">;
  providers: Record<DesignProvider, Pick<DesignProviderClient, "connected">>;
  penpotInstance(): string | null;
};

const USER = { origin: "user", instanceId: null } as const;
const MAX_NAME = 200;

export async function linkDesignFrame(
  deps: LinkDeps,
  projectId: string,
  ticketId: string,
  raw: string,
): Promise<ExternalRef> {
  const { key, url } = parseFrameUrl(raw, deps.penpotInstance());
  if (!(await deps.providers[key.provider].connected()))
    throw new KiboError("NOT_CONNECTED", `${key.provider} is not connected`);
  const name = (await deps.service.metadata(key)).name.slice(0, MAX_NAME);
  const ref: ExternalRef =
    key.provider === "figma"
      ? { kind: "figma_node", fileKey: key.fileKey, nodeId: key.nodeId, url, name }
      : {
          kind: "penpot_board",
          instance: key.instance,
          fileId: key.fileId,
          pageId: key.pageId,
          boardId: key.boardId,
          url,
          name,
        };
  deps.host.command(projectId, { method: "upsertExternalRef", ticketId, ref }, USER);
  return ref;
}
