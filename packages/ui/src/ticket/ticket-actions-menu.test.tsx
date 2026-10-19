import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { ProjectEvent, RpcRequest, TicketView } from "@kibo/schema";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { MERGE_RULE, MINIO, siloHeldProject } from "../shell/feature/fixture";

const calls: RpcRequest[] = [];
const journal: ProjectEvent[] = [
  {
    id: 4,
    projectId: "silo",
    kind: "held",
    ticketId: "e31",
    featureId: "f5",
    source: "user",
    data: { reason: "Accès VPN du client" },
    at: 1,
  },
];

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "getProject") return siloHeldProject();
        if (req.method === "listProjectEvents") return { items: journal, nextBefore: null };
        return null;
      },
      subscribe: () => () => undefined,
    },
  }),
);

const { TicketActionsMenu } = await import("./TicketActionsMenu");

beforeEach(() => {
  calls.length = 0;
});
afterEach(cleanup);

const project = siloHeldProject();
const find = (id: string): TicketView => {
  const t = project.tickets.find((x) => x.id === id);
  if (!t) throw new Error(`fixture without ${id}`);
  return t;
};

const openMenu = async (ticket: TicketView, editable = true) => {
  const user = userEvent.setup();
  render(
    <TicketActionsMenu
      projectId="silo"
      ticket={ticket}
      childCount={0}
      editable={editable}
      onOpenInTab={null}
      onDeleted={() => undefined}
    />,
  );
  await user.click(screen.getByRole("button", { name: `Actions ${ticket.keyLabel}` }));
  const items = (await screen.findAllByRole("menuitem")).map((i) => i.textContent);
  return { user, items };
};

const sentCommands = () => calls.flatMap((c) => (c.method === "command" ? [c.command] : []));

test("a step to do can be put on hold with a reason, sent without its day", async () => {
  const { user, items } = await openMenu(find("e32"));
  expect(items).toEqual(["Copier la clé", "Mettre en attente…", "Supprimer…"]);
  await user.click(screen.getByRole("menuitem", { name: "Mettre en attente…" }));
  const dialog = await screen.findByRole("dialog", { name: "Mettre SILO-32 en attente" });
  await waitFor(() => expect(within(dialog).getByRole("button", { name: MINIO })).toBeTruthy());
  expect(
    within(dialog)
      .getAllByRole("button")
      .map((b) => b.textContent)
      .filter((t) => t === MINIO || t === MERGE_RULE || t === "Accès VPN du client"),
  ).toEqual([MERGE_RULE, MINIO, "Accès VPN du client"]);
  await user.click(within(dialog).getByRole("button", { name: MINIO }));
  await user.click(within(dialog).getByRole("button", { name: "Mettre en attente" }));
  expect(sentCommands()).toEqual([{ method: "setHold", ticketId: "e32", reason: MINIO }]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("a feature, a delivered step and a reader have no hold entry", async () => {
  expect((await openMenu(find("f5"))).items).not.toContain("Mettre en attente…");
  cleanup();
  expect((await openMenu(find("e31"))).items).not.toContain("Mettre en attente…");
  cleanup();
  expect((await openMenu(find("e32"), false)).items).toEqual(["Copier la clé"]);
});

test("a step on hold offers « Reprendre » instead, which lifts the hold", async () => {
  const { user, items } = await openMenu(find("e33"));
  expect(items).toEqual(["Copier la clé", "Reprendre", "Supprimer…"]);
  await user.click(screen.getByRole("menuitem", { name: "Reprendre" }));
  await waitFor(() => expect(sentCommands()).toEqual([{ method: "setHold", ticketId: "e33", reason: null }]));
});

test("a step waiting on another one can still be put on hold itself", async () => {
  expect((await openMenu(find("e34"))).items).toContain("Mettre en attente…");
});
