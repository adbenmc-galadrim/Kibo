import { afterEach, expect, setSystemTime, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { OfflineBand } from "./screens/OfflineBand";

const at = (hours: number, minutes: number) => new Date(2026, 9, 16, hours, minutes).getTime();

afterEach(() => {
  setSystemTime();
});

test("OfflineBand shows the snapshot time, not now", () => {
  setSystemTime(new Date(at(15, 10)));
  render(<OfflineBand presence={{ macOnline: false, phoneOnline: true, lastSnapshotAt: at(14, 52) }} />);
  expect(screen.getByRole("status").textContent).toBe("Mac éteint · dernier état à 14:52");
});

test('OfflineBand says "Hors connexion" when the phone is offline', () => {
  render(<OfflineBand presence={{ macOnline: true, phoneOnline: false, lastSnapshotAt: at(9, 5) }} />);
  expect(screen.getByRole("status").textContent).toBe("Hors connexion · dernier état à 09:05");
});

test("OfflineBand stays hidden while the mac and the phone are online", () => {
  const { container } = render(
    <OfflineBand presence={{ macOnline: true, phoneOnline: true, lastSnapshotAt: at(9, 5) }} />,
  );
  expect(container.textContent).toBe("");
});

test("OfflineBand admits it has no state yet", () => {
  render(<OfflineBand presence={{ macOnline: false, phoneOnline: true, lastSnapshotAt: null }} />);
  expect(screen.getByRole("status").textContent).toBe("Mac éteint · aucun état reçu");
});
