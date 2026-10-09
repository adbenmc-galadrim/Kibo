import {
  type DesignFrame,
  designFrameId,
  type EmbedView,
  KiboError,
  lookupStory,
  type StorybookFrameKey,
} from "@kibo/schema";
import type { StorybookClient } from "./providers/storybook";
import type { FrameMeta } from "./providers/types";
import type { StorybookOrigins } from "./storybook-origins";

export type EmbedOpener = {
  open(instanceId: string, kind: "storybook", target: string, title: string): EmbedView;
};
export type StoryFrameDeps = {
  client: StorybookClient;
  origins: StorybookOrigins;
  embed: EmbedOpener;
};
type StoryRequest = { instanceId: string; key: StorybookFrameKey; url: string; refresh: boolean };

async function storyName(client: StorybookClient, key: StorybookFrameKey): Promise<string> {
  const found = lookupStory(await client.index(key.origin), key.storyId);
  if (found.kind === "missing")
    throw new KiboError("REMOTE_NOT_FOUND", `story ${key.storyId} is not in this storybook`);
  return found.kind === "named" ? found.name : key.storyId;
}

export async function storyMetadata(deps: StoryFrameDeps, key: StorybookFrameKey): Promise<FrameMeta> {
  return { name: await storyName(deps.client, key), width: null, height: null };
}

export async function storyFrame(
  deps: StoryFrameDeps,
  req: StoryRequest,
  projectId: string | null,
  now: number,
): Promise<DesignFrame> {
  const { key } = req;
  if (projectId === null)
    throw new KiboError("INVALID_INPUT", "a storybook story is shown in a mockup widget only");
  await deps.origins.assertAllowed(projectId, key.origin);
  if (req.refresh) deps.client.forget(key.origin);
  if (!(await deps.client.probe(key.origin)))
    throw new KiboError("REMOTE_UNAVAILABLE", `storybook ${new URL(key.origin).host} is unreachable`);
  const name = await storyName(deps.client, key);
  const view = deps.embed.open(req.instanceId, "storybook", req.url, name);
  return {
    id: designFrameId(key),
    provider: "storybook",
    name,
    width: null,
    height: null,
    url: view.url,
    mime: "text/html",
    fetchedAt: now,
    stale: false,
    reachable: true,
    source: `${key.origin}/?path=/story/${key.storyId}`,
  };
}
