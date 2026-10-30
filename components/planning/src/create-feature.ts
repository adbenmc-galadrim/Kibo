import type { Ticket } from "@kibo/schema";
import type { KiboSdk } from "@kibo/sdk";

type FeatureDraft = {
  name: string;
  expected: string;
  sprintId: string | null;
  steps: readonly string[];
  lastOptional: boolean;
};

type FeatureSdk = Pick<KiboSdk, "run" | "sprints">;

type FeatureProgress = {
  rootId: string | null;
  stepIds: string[];
  optional: boolean;
  planned: boolean;
};

export const freshProgress = (): FeatureProgress => ({
  rootId: null,
  stepIds: [],
  optional: false,
  planned: false,
});

async function ensureRoot(sdk: FeatureSdk, draft: FeatureDraft, progress: FeatureProgress): Promise<string> {
  if (progress.rootId !== null) return progress.rootId;
  const root: Ticket = await sdk.run({
    method: "createTicket",
    title: draft.name,
    description: draft.expected,
    feature: true,
  });
  progress.rootId = root.id;
  return root.id;
}

export async function createFeature(
  sdk: FeatureSdk,
  draft: FeatureDraft,
  progress: FeatureProgress,
): Promise<void> {
  const rootId = await ensureRoot(sdk, draft, progress);
  for (const title of draft.steps.slice(progress.stepIds.length)) {
    const step: Ticket = await sdk.run({ method: "createTicket", title, parentId: rootId });
    progress.stepIds.push(step.id);
  }
  const last = progress.stepIds.at(-1);
  if (draft.lastOptional && last !== undefined && !progress.optional) {
    await sdk.run({ method: "setTicketOptional", ticketId: last, optional: true });
    progress.optional = true;
  }
  if (draft.sprintId !== null && !progress.planned) {
    await sdk.sprints.assign(rootId, draft.sprintId);
    progress.planned = true;
  }
}
