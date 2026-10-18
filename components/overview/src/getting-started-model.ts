import { deliveryBrief, type TicketView } from "@kibo/schema";
import type { ProjectInfo } from "@kibo/sdk";

export type StartStep = "folder" | "feature" | "copy";
export type GettingStartedModel = {
  done: Record<StartStep, boolean>;
  command: string;
  target: TicketView | null;
};

const isStep = (t: TicketView) => t.parentId !== null && t.key !== null;

export function firstStep(tickets: readonly TicketView[]): TicketView | null {
  const steps = tickets.filter(isStep);
  const open = steps.filter((t) => t.statusId !== "done");
  return open.find((t) => t.startable) ?? open[0] ?? steps[0] ?? null;
}

export function gettingStarted(
  project: Pick<ProjectInfo, "key" | "hasFolder">,
  tickets: readonly TicketView[],
  copied: boolean,
): GettingStartedModel | null {
  const hasFeature = tickets.some((t) => t.feature !== null);
  if (project.hasFolder && hasFeature) return null;
  const target = firstStep(tickets);
  return {
    done: { folder: project.hasFolder, feature: hasFeature, copy: copied },
    command: deliveryBrief(target?.key ?? `${project.key}-1`),
    target,
  };
}
