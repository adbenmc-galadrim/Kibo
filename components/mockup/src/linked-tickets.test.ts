import { expect, test } from "bun:test";
import type { DesignFrameKey, ProjectCommand, TicketView } from "@kibo/schema";
import { createMockSdk } from "@kibo/sdk/mock";
import { manifest } from "./index";
import { linkedTickets } from "./linked-tickets";

const FIGMA: DesignFrameKey = { provider: "figma", fileKey: "AbC123xyz", nodeId: "12:34" };
const PENPOT = {
  instance: "https://design.penpot.app",
  fileId: "33333333-3333-4333-8333-333333333333",
  pageId: "44444444-4444-4444-8444-444444444444",
  boardId: "55555555-5555-4555-8555-555555555555",
};

function seeded(): TicketView[] {
  const seed = (run: (cmd: ProjectCommand) => unknown) => {
    const figma = run({ method: "createTicket", title: "Figma" }) as { id: string };
    run({
      method: "upsertExternalRef",
      ticketId: figma.id,
      ref: {
        kind: "figma_node",
        fileKey: "AbC123xyz",
        nodeId: "12:34",
        url: "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34",
        name: "Tickets",
      },
    });
    const penpot = run({ method: "createTicket", title: "Penpot" }) as { id: string };
    run({
      method: "upsertExternalRef",
      ticketId: penpot.id,
      ref: {
        kind: "penpot_board",
        ...PENPOT,
        url: `https://design.penpot.app/#/view/${PENPOT.fileId}?page-id=${PENPOT.pageId}&board-id=${PENPOT.boardId}`,
        name: "Board",
      },
    });
    run({ method: "createTicket", title: "Seul" });
  };
  return createMockSdk(manifest, { seed }).snapshot().tickets;
}

test("only tickets referencing the same frame are linked", () => {
  const tickets = seeded();
  expect(linkedTickets(tickets, FIGMA).map((t) => t.title)).toEqual(["Figma"]);
  expect(linkedTickets(tickets, { provider: "penpot", ...PENPOT }).map((t) => t.title)).toEqual(["Penpot"]);
});

test("a frame no ticket references links nothing", () => {
  expect(linkedTickets(seeded(), { ...FIGMA, nodeId: "1:2" })).toEqual([]);
});
