import { afterEach, expect, test } from "bun:test";
import { DndContext } from "@dnd-kit/core";
import type { TicketView } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cardTooltipRows } from "./CardTooltip";
import { manifest } from "./index";
import { KanbanCard } from "./KanbanCard";
import { type CardFacts, KanbanCardContent } from "./KanbanCardContent";
import { seed } from "./test-seed";

afterEach(cleanup);

const sdkOf = () => createMockSdk(manifest, { seed });

const baseTicket = (m: ReturnType<typeof sdkOf>): TicketView => {
  const base = m.snapshot().tickets.find((t) => t.keyLabel === "KIB-1");
  if (!base) throw new Error("no seeded ticket");
  return base;
};

const PR = {
  kind: "github_pr",
  url: "https://github.com/o/r/pull/29",
  number: 29,
  state: "open",
  base: null,
  head: null,
  review: "none",
  checks: null,
} as const;

const QUESTION = { number: 6, importRef: null };

const BRANCH = { kind: "git_branch", base: null, branch: "feat/envoi" } as const;

const renderContent = (patch: Partial<TicketView>, facts: Partial<CardFacts> = {}) => {
  const m = sdkOf();
  return render(
    <SdkProvider sdk={m.sdk}>
      <KanbanCardContent
        ticket={{ ...baseTicket(m), ...patch }}
        group={null}
        blocked={false}
        blocking={null}
        {...facts}
        menu={null}
        title={<span>Titre</span>}
      />
    </SdkProvider>,
  ).container;
};

test("a card shows key · F, title, the one-line reason for a question-blocked ticket, a single signal, no labels, no branch", () => {
  const c = renderContent(
    {
      labels: ["area:mobile"],
      externalRefs: [BRANCH],
      blockedReason: "Attente du client",
      openQuestions: 2,
      waitingOn: ["SILO-5"],
    },
    { blocked: true, blocking: QUESTION },
  );
  expect(screen.getByText("KIB-1")).toBeTruthy();
  expect(screen.getByText("Titre")).toBeTruthy();
  expect(screen.getByText("Motif : Attente du client").className).toContain("truncate");
  expect(screen.getByText("bloqué · Q6")).toBeTruthy();
  expect(c.querySelectorAll("[data-card-signal]")).toHaveLength(1);
  expect(c.textContent).not.toContain("area:mobile");
  expect(c.textContent).not.toContain("feat/envoi");
  expect(c.textContent).not.toContain("question");
  expect(c.textContent).not.toContain("attend");
});

test("requested changes wear amber with the PR icon, the PR stays zinc and no CI is shown", () => {
  const c = renderContent({
    statusId: "in_review",
    externalRefs: [{ ...PR, review: "changes_requested" }],
    onHold: { source: "own", key: "SILO-9", reason: "Staging client", since: "2026-10-16" },
    delivery: { step: 10, note: "", at: 0, runId: null, kind: "delivery" },
  });
  const signal = c.querySelector("[data-card-signal]");
  expect(signal?.getAttribute("data-card-signal")).toBe("changes");
  expect(signal?.className).toContain("amber");
  expect(signal?.querySelector("svg")).toBeTruthy();
  expect(c.querySelector("[data-pr]")?.innerHTML).not.toContain("purple");
  expect(c.querySelector("[data-pr]")?.textContent).toBe("#29");
  expect(c.querySelector("[data-delivery-step]")?.textContent).toBe("Étape 10/12");
  expect(c.querySelector("[data-ci]")).toBeNull();
  expect(c.textContent).not.toContain("Staging");
});

test("waiting for steps reads one chip in zinc with an hourglass", () => {
  const c = renderContent({ waitingOn: ["SILO-51", "SILO-52"] });
  const signal = c.querySelector("[data-card-signal]");
  expect(signal?.getAttribute("data-card-signal")).toBe("waiting");
  expect(signal?.textContent).toBe("attend SILO-51, SILO-52");
  expect(signal?.querySelector("svg")).toBeTruthy();
});

test("the hover tooltip lists Étiquettes, Branche, En attente, Questions, Motif, only when present", () => {
  const rows = (patch: Partial<TicketView>) => {
    const m = sdkOf();
    return cardTooltipRows({ ...baseTicket(m), labels: [], externalRefs: [], openQuestions: 0, ...patch });
  };
  expect(rows({ onHold: null, waitingOn: [], blockedReason: null })).toEqual([]);
  const full = rows({
    labels: ["area:mobile", "web"],
    externalRefs: [BRANCH],
    onHold: { source: "own", key: "SILO-9", reason: "Serveur indisponible", since: "2026-10-16" },
    openQuestions: 1,
    blockedReason: "Attente du client",
  });
  expect(full.map(([label]) => label)).toEqual(["Étiquettes", "Branche", "En attente", "Questions", "Motif"]);
  expect(full[2]?.[1]).toBe("Serveur indisponible");
  expect(full[3]?.[1]).toBe("1 ouverte");
  expect(full[4]?.[1]).toBe("Attente du client");
  expect(rows({ openQuestions: 2 })).toEqual([["Questions", "2 ouvertes"]]);
  expect(rows({ onHold: null, waitingOn: ["SILO-5", "SILO-6"] })).toEqual([["En attente", "SILO-5, SILO-6"]]);
});

const renderCard = (patch: Partial<TicketView>) => {
  const m = sdkOf();
  const ticket = { ...baseTicket(m), ...patch };
  return render(
    <SdkProvider sdk={m.sdk}>
      <DndContext>
        <KanbanCard
          ticket={ticket}
          group={null}
          blocked={false}
          blocking={null}
          selected={null}
          statuses={[]}
          onOpen={() => {}}
          onMove={() => {}}
          onRemove={() => {}}
        />
      </DndContext>
    </SdkProvider>,
  ).container;
};

test("the card opens its tooltip on the keyboard focus", async () => {
  const c = renderCard({ openQuestions: 1 });
  const article = c.querySelector("article");
  if (!article) throw new Error("no card");
  fireEvent.focus(article);
  await waitFor(() =>
    expect(document.querySelector('[data-slot="tooltip-rows"]')?.textContent).toContain("1 ouverte"),
  );
});

test("the orange session border stays", () => {
  const c = renderCard({ session: { tool: "T3 Code", startedAt: 0 } });
  expect(c.querySelector("article")?.className).toContain("border-(--tracking-brand-line)");
});
