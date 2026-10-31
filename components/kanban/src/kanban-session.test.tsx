import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen } from "@testing-library/react";
import { manifest } from "./index";
import { KanbanCardContent } from "./KanbanCardContent";
import { seed } from "./test-seed";

const renderCard = (patch: Partial<TicketView>) => {
  const m = createMockSdk(manifest, { seed });
  const base = m.snapshot().tickets.find((t) => t.keyLabel === "KIB-1");
  if (!base) throw new Error("no seeded ticket");
  return render(
    <SdkProvider sdk={m.sdk}>
      <KanbanCardContent
        ticket={{ ...base, ...patch }}
        group={null}
        ciRuns={[]}
        blocked={false}
        blocking={null}
        questions={{ questions: [], recipients: [], onOpen: () => {} }}
        menu={null}
        title={<span>{base.title}</span>}
      />
    </SdkProvider>,
  ).container;
};

test("a T3 Code session puts the orange dot on the card", () => {
  renderCard({ session: { tool: "T3 Code", startedAt: 0 } });
  expect(screen.getByRole("img", { name: "Session T3 Code en cours" })).toBeTruthy();
});

test("no session, no dot", () => {
  renderCard({ session: null });
  expect(screen.queryByRole("img", { name: "Session T3 Code en cours" })).toBeNull();
});

test("a touch-up on a done card reads retouche · Étape 7/12", () => {
  const c = renderCard({
    statusId: "done",
    delivery: { step: 7, note: "", at: 0, runId: null, kind: "update" },
  });
  expect(c.querySelector("[data-delivery-step]")?.textContent).toBe("retouche · Étape 7/12");
});

test("the card shows Étape n/12 alone, its tooltip names the step", () => {
  const c = renderCard({ delivery: { step: 9, note: "", at: 0, runId: null, kind: "delivery" } });
  const chip = c.querySelector("[data-delivery-step]");
  expect(chip?.textContent).toBe("Étape 9/12");
  expect(chip?.getAttribute("title")).toBe("Étape 9 sur 12 de full-delivery : Review");
});

test("a delivered card without touch-up shows no step chip", () => {
  const c = renderCard({
    statusId: "done",
    delivery: { step: 11, note: "", at: 0, runId: null, kind: "delivery" },
  });
  expect(c.querySelector("[data-delivery-step]")).toBeNull();
});

test("the reason of a blocked ticket is zinc and holds on one line", () => {
  const c = renderCard({ blockedReason: "Attente du client" });
  const reason = screen.getByText("Motif : Attente du client");
  expect(reason.className).not.toContain("red");
  expect(reason.className).toContain("truncate");
  expect(c.contains(reason)).toBe(true);
});
