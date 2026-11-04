import { afterEach, expect, setSystemTime, test } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import type { Presence } from "./remote-client";
import { OfflineBand } from "./screens/OfflineBand";

const at = (hours: number, minutes: number) => new Date(2026, 9, 16, hours, minutes).getTime();

afterEach(() => {
  setSystemTime();
});

test("OfflineBand shows the snapshot time, not now", () => {
  setSystemTime(new Date(at(15, 10)));
  render(
    <OfflineBand
      presence={{ macOnline: false, phoneOnline: true, stale: false, lastSnapshotAt: at(14, 52) }}
    />,
  );
  expect(screen.getByRole("status").textContent).toBe("Mac éteint · dernier état à 14:52");
});

test('OfflineBand says "Hors connexion" when the phone is offline', () => {
  render(
    <OfflineBand presence={{ macOnline: true, phoneOnline: false, stale: true, lastSnapshotAt: at(9, 5) }} />,
  );
  expect(screen.getByRole("status").textContent).toBe("Hors connexion · dernier état à 09:05");
});

test("OfflineBand stays hidden while the mac and the phone are online", () => {
  const { container } = render(
    <OfflineBand presence={{ macOnline: true, phoneOnline: true, stale: false, lastSnapshotAt: at(9, 5) }} />,
  );
  expect(container.textContent).toBe("");
});

test("OfflineBand admits it has no state yet", () => {
  render(
    <OfflineBand presence={{ macOnline: false, phoneOnline: true, stale: true, lastSnapshotAt: null }} />,
  );
  expect(screen.getByRole("status").textContent).toBe("Mac éteint · aucun état reçu");
});

test("OfflineBand says the update failed when the mac is online but the state is stale", () => {
  setSystemTime(new Date(at(15, 10)));
  render(
    <OfflineBand
      presence={{ macOnline: true, phoneOnline: true, stale: true, lastSnapshotAt: at(14, 52) }}
    />,
  );
  expect(screen.getByRole("status").textContent).toBe("Mise à jour impossible · dernier état à 14:52");
});

const manualClock = () => {
  const pending: { ms: number; run(): void; cancelled: boolean }[] = [];
  return {
    pending,
    schedule: (run: () => void, ms: number) => {
      const timer = { ms, run, cancelled: false };
      pending.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    elapse: () =>
      act(() => {
        for (const timer of pending.splice(0)) if (!timer.cancelled) timer.run();
      }),
  };
};

const syncingAfter = (presence: Presence) => {
  const clock = manualClock();
  const { container } = render(<OfflineBand presence={presence} schedule={clock.schedule} />);
  expect(container.textContent).toBe("");
  expect(clock.pending.map((t) => t.ms)).toEqual([1_000]);
  clock.elapse();
  expect(screen.getByRole("status").textContent).toBe("Synchronisation…");
};

test("OfflineBand says Synchronisation… after a second while the event socket reconnects", () => {
  syncingAfter({
    macOnline: false,
    phoneOnline: true,
    reconnecting: true,
    stale: false,
    lastSnapshotAt: at(9, 5),
  });
});

test("OfflineBand says Synchronisation… after a second when back in the foreground, before the sync ends", () => {
  syncingAfter({ macOnline: true, phoneOnline: true, stale: true, syncing: true, lastSnapshotAt: at(9, 5) });
});

test("OfflineBand never flashes Synchronisation… when the sync ends within the second", () => {
  const clock = manualClock();
  const syncing: Presence = {
    macOnline: true,
    phoneOnline: true,
    stale: true,
    syncing: true,
    lastSnapshotAt: at(9, 5),
  };
  const { container, rerender } = render(<OfflineBand presence={syncing} schedule={clock.schedule} />);
  rerender(<OfflineBand presence={{ ...syncing, stale: false, syncing: false }} schedule={clock.schedule} />);
  clock.elapse();
  expect(container.textContent).toBe("");
});

test("OfflineBand keeps Hors connexion over a reconnection when the phone has no network", () => {
  render(
    <OfflineBand
      presence={{
        macOnline: false,
        phoneOnline: false,
        reconnecting: true,
        stale: true,
        syncing: true,
        lastSnapshotAt: at(9, 5),
      }}
    />,
  );
  expect(screen.getByRole("status").textContent).toBe("Hors connexion · dernier état à 09:05");
});

test("OfflineBand says Mac éteint once the server has said the mac is offline", () => {
  render(
    <OfflineBand
      presence={{
        macOnline: false,
        phoneOnline: true,
        reconnecting: false,
        stale: false,
        lastSnapshotAt: at(9, 5),
      }}
    />,
  );
  expect(screen.getByRole("status").textContent).toBe("Mac éteint · dernier état à 09:05");
});
