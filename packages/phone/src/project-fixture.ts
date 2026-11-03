import { manifest as kanban } from "@kibo/component-kanban";
import type { Instance, ProjectCommand, ProjectSnapshot, TicketView } from "@kibo/schema";
import { createMockSdk } from "@kibo/sdk/mock";

export const SILO_TODAY = "2026-10-16";

type Run = (cmd: ProjectCommand) => unknown;
type ProjectFixture = {
  id: string;
  name: string;
  key: string;
  color: string;
  seed: (run: Run) => void;
  instances?: Instance[];
};

const rekey = (label: string, key: string) => label.replace(/^KIB-/, `${key}-`);

const rekeyed = (t: TicketView, key: string): TicketView => ({
  ...t,
  key: t.key === null ? null : rekey(t.key, key),
  keyLabel: rekey(t.keyLabel, key),
});

export function projectSnapshot(p: ProjectFixture): ProjectSnapshot {
  const snapshot = createMockSdk(kanban, {
    seed: p.seed,
    viewer: "adam",
    today: SILO_TODAY,
    folder: `/Users/adam/${p.id}`,
  }).snapshot();
  return {
    ...snapshot,
    meta: { ...snapshot.meta, id: p.id, key: p.key, name: p.name, color: p.color },
    tickets: snapshot.tickets.map((t) => rekeyed(t, p.key)),
    instances: p.instances ?? [],
    viewer: "adam",
  };
}
