import { expect, test } from "bun:test";
import type { Ticket } from "@kibo/schema";
import { createMockSdk } from "../mock";

const manifest = (writes: "ticket"[]) => ({
  id: "planner",
  version: "1.0.0",
  kind: "view" as const,
  title: "Planner",
  reads: ["ticket" as const],
  writes,
});
const MINIO = "Serveur MinIO de recette indisponible";
const DAY = "2026-10-16";

const seeded = (writes: "ticket"[], holds = false) => {
  let step = "";
  const mock = createMockSdk(manifest(writes), {
    seed: (run) => {
      const feature = run({ method: "createTicket", title: "Envoi hors ligne", feature: true }) as Ticket;
      step = (run({ method: "createTicket", title: "Écran", parentId: feature.id }) as Ticket).id;
    },
    ...(holds ? { holds: [{ ticketId: "KIB-1", reason: MINIO, since: DAY }] } : {}),
  });
  return { mock, step };
};

test("a component that writes tickets puts a step on hold and resumes it", async () => {
  const { mock, step } = seeded(["ticket"]);
  const held = await mock.sdk.run({ method: "setHold", ticketId: step, reason: "R", since: DAY });
  expect(held.hold).toEqual({ reason: "R", since: DAY });
  expect(mock.snapshot().tickets.find((t) => t.id === step)?.onHold).toEqual({
    source: "own",
    key: "KIB-1",
    reason: "R",
    since: DAY,
  });
  await mock.sdk.run({ method: "setHold", ticketId: step, reason: null });
  expect(mock.snapshot().tickets.find((t) => t.id === step)?.onHold).toBeNull();
  expect(mock.violations).toEqual([]);
});

test("a component that does not write tickets is refused, and the violation is recorded", async () => {
  const { mock, step } = seeded([]);
  await expect(mock.sdk.run({ method: "setHold", ticketId: step, reason: "R", since: DAY })).rejects.toThrow(
    "PERMISSION_DENIED",
  );
  expect(mock.violations).toEqual(["write setHold"]);
});

test("the mock puts the given steps on hold after its seed, by key", () => {
  const { mock, step } = seeded(["ticket"], true);
  expect(mock.snapshot().tickets.find((t) => t.id === step)?.hold).toEqual({ reason: MINIO, since: DAY });
});
