import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest, TicketView } from "@kibo/schema";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { siloHeldProject } from "../shell/feature/fixture";

const calls: RpcRequest[] = [];
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        return null;
      },
    },
  }),
);

const { HoldBanner } = await import("./HoldBanner");

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
const opened: string[] = [];
const draw = (ticket: TicketView, editable = true) => {
  opened.length = 0;
  return render(
    <HoldBanner
      projectId="silo"
      ticket={ticket}
      tickets={project.tickets}
      editable={editable}
      onOpenTicket={(id) => void opened.push(id)}
    />,
  );
};

test("a step on hold shows its reason, its day and « Reprendre », which lifts the hold", async () => {
  draw(find("e45"));
  const banner = screen.getByRole("status", { name: "Étape en attente" });
  expect(banner.textContent).toContain(
    "En attente · Règle de fusion à valider par le client · depuis le 16 oct.",
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Reprendre" }));
  await waitFor(() =>
    expect(calls).toEqual([
      { method: "command", projectId: "silo", command: { method: "setHold", ticketId: "e45", reason: null } },
    ]),
  );
});

test("a step waiting on a held one names it and opens it", async () => {
  draw(find("e34"));
  expect(screen.getByRole("status", { name: "Étape en attente" }).textContent).toContain(
    "En attente de SILO-33",
  );
  expect(screen.queryByRole("button", { name: "Reprendre" })).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir SILO-33" }));
  expect(opened).toEqual(["e33"]);
});

test("no banner without a hold, and no « Reprendre » for a reader", () => {
  const { container } = draw(find("e32"));
  expect(container.textContent).toBe("");
  cleanup();
  draw(find("e45"), false);
  expect(screen.getByRole("status", { name: "Étape en attente" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Reprendre" })).toBeNull();
});
