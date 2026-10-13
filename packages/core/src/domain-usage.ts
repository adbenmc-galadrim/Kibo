import { countDomainUsage, type DomainUsageCount, KiboError, type UsageProject } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { projectIdOf } from "./config-store";
import { getKeyAllocator } from "./keys";
import { listProjectDomains } from "./project-domains";
import { listTickets } from "./tickets";

export function usageProjectOf(doc: LoroDoc): UsageProject {
  const id = projectIdOf(doc);
  if (id === undefined) throw new KiboError("INVALID_INPUT", "domain usage is read from a project");
  return {
    id,
    shared: getKeyAllocator(doc) === "server",
    domainIds: listProjectDomains(doc).map((d) => d.id),
    ticketDomains: listTickets(doc).map((t) => t.domainId),
  };
}

export function domainUsageOfProjects(docs: readonly LoroDoc[]): DomainUsageCount {
  return countDomainUsage(docs.map(usageProjectOf));
}
