import {
  formatRef,
  type ImportRef,
  isFeature,
  type ProjectCommand,
  type ProjectSnapshot,
  ShortKey,
  splitRef,
  type TicketView,
} from "@kibo/schema";

export const PLANNING_COMPONENT = "planning";
export const PLANNING_COMPONENT_REF = formatRef(PLANNING_COMPONENT, "1.0.0");
export const PLANNING_PAGE_TITLE = "Planning";

const PLAN_SOURCE = "plan";
const FEATURE_PREFIX = "F";

const planKeyOf = (t: TicketView): string | null => {
  const ref = t.externalRefs.find((r): r is ImportRef => r.kind === "import_ref" && r.source === PLAN_SOURCE);
  return ref !== undefined && ShortKey.safeParse(ref.id).success ? ref.id : null;
};

const keyCommand = (ticketId: string, shortKey: string): ProjectCommand => ({
  method: "updateTicket",
  ticketId,
  shortKey,
});

function shortKeyCommands(tickets: readonly TicketView[]): ProjectCommand[] {
  const used = new Set(tickets.flatMap((t) => (t.shortKey === null ? [] : [t.shortKey])));
  const unkeyed = tickets.filter((t) => isFeature(t) && t.shortKey === null);
  const planned: ProjectCommand[] = [];
  const rest: TicketView[] = [];
  for (const t of unkeyed) {
    const key = planKeyOf(t);
    if (key === null || used.has(key)) rest.push(t);
    else {
      used.add(key);
      planned.push(keyCommand(t.id, key));
    }
  }
  let seq = 0;
  const numbered = rest.map((t) => {
    do seq += 1;
    while (used.has(`${FEATURE_PREFIX}${seq}`));
    return keyCommand(t.id, `${FEATURE_PREFIX}${seq}`);
  });
  return [...planned, ...numbered];
}

function planningPageCommands(snapshot: ProjectSnapshot): ProjectCommand[] {
  if (snapshot.instances.some((i) => splitRef(i.component).id === PLANNING_COMPONENT)) return [];
  const filled = new Set(snapshot.instances.map((i) => i.pageId));
  const empty = snapshot.pages.find(
    (p) => p.kind === "view" && p.title === PLANNING_PAGE_TITLE && !filled.has(p.id),
  );
  if (empty !== undefined)
    return [{ method: "addInstance", pageId: empty.id, component: PLANNING_COMPONENT_REF }];
  return [{ method: "addPage", title: PLANNING_PAGE_TITLE, kind: "view" }];
}

export function trackingMigrationCommands(snapshot: ProjectSnapshot): ProjectCommand[] {
  return [...shortKeyCommands(snapshot.tickets), ...planningPageCommands(snapshot)];
}
