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

function duplicatedKeys(tickets: readonly TicketView[]): { used: Set<string>; duplicated: Set<string> } {
  const used = new Set<string>();
  const duplicated = new Set<string>();
  for (const t of tickets) {
    if (t.shortKey === null) continue;
    if (used.has(t.shortKey)) duplicated.add(t.id);
    else used.add(t.shortKey);
  }
  return { used, duplicated };
}

function shortKeyCommands(tickets: readonly TicketView[]): ProjectCommand[] {
  const { used, duplicated } = duplicatedKeys(tickets);
  const planned: ProjectCommand[] = [];
  const rest: TicketView[] = [];
  for (const t of tickets) {
    if (duplicated.has(t.id)) rest.push(t);
    if (!isFeature(t) || t.shortKey !== null) continue;
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

export type TrackingMigrationOptions = { planningPage: boolean };

export function trackingMigrationCommands(
  snapshot: ProjectSnapshot,
  options: TrackingMigrationOptions = { planningPage: true },
): ProjectCommand[] {
  const keys = shortKeyCommands(snapshot.tickets);
  return options.planningPage ? [...keys, ...planningPageCommands(snapshot)] : keys;
}
