import { afterEach, expect, setSystemTime, test } from "bun:test";
import { render, screen } from "@testing-library/react";
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
