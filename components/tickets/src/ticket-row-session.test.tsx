import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen } from "@testing-library/react";
import { manifest } from "./index";
import { TicketRow } from "./TicketRow";
import { TODAY, trackingSeed } from "./test-seed";

const NOW = Date.UTC(2026, 9, 16, 12, 52);

const renderRow = (patch: Partial<TicketView>) => {
  const m = createMockSdk(manifest, { seed: trackingSeed(NOW), today: TODAY });
  const base = m.snapshot().tickets.find((t) => t.title === "Écran d'envoi hors ligne");
  if (!base) throw new Error("no seeded ticket");
  const ticket = { ...base, ...patch };
  render(
    <SdkProvider sdk={m.sdk}>
      <ul>
        <TicketRow
          ticket={ticket}
          feature={null}
          ciRuns={[]}
          run={null}
          execution="hidden"
          members={[]}
          statusLabel="En cours"
          entries={[]}
          readOnly
          canDrag={false}
          questions={{ questions: [], recipients: [], runLabel: () => "", onOpen: () => {} }}
          selected={null}
          dimmed={false}
          now={NOW}
        />
      </ul>
    </SdkProvider>,
  );
  return ticket;
};

test("a T3 Code session puts the orange dot after the title, the execution being hidden", () => {
  renderRow({ session: { tool: "T3 Code", startedAt: NOW - 42 * 60_000 } });
  expect(screen.getByRole("img", { name: "Session T3 Code en cours" })).toBeTruthy();
});

test("Mis à jour reads the last event of the ticket before its delivery step", () => {
  renderRow({ updatedAt: NOW - 9 * 60_000 });
  expect(screen.getByText("il y a 9 min")).toBeTruthy();
});
