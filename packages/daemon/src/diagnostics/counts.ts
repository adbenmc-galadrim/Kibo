import { listInstances, listProjects, listTickets } from "@kibo/core";
import { listProfiles } from "@kibo/core/agent-profiles";
import type { Diagnostics } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";

type CountsDeps = { workspace: LoroDoc; project(id: string): LoroDoc; components(): number };

export function diagnosticCounts(deps: CountsDeps): Diagnostics["counts"] {
  const docs = listProjects(deps.workspace).map((meta) => deps.project(meta.id));
  const sum = (count: (doc: LoroDoc) => number) => docs.reduce((total, doc) => total + count(doc), 0);
  return {
    projects: docs.length,
    tickets: sum((doc) => listTickets(doc).length),
    components: deps.components(),
    instances: sum((doc) => listInstances(doc).length),
    profiles: listProfiles(deps.workspace).length,
  };
}
