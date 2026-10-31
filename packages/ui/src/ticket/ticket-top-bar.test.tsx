import { afterEach, expect, mock, test } from "bun:test";
import type { RpcRequest, TicketView } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { siloFeatureProject } from "../shell/feature/fixture";

const calls: RpcRequest[] = [];
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        return req.method === "t3.status" ? { available: true, bin: "t3" } : null;
      },
      subscribe: () => () => undefined,
    },
  }),
);

const { TicketActionsMenu } = await import("./TicketActionsMenu");
const { TicketHeader } = await import("./TicketHeader");
const { TicketTopBar } = await import("./TicketTopBar");

afterEach(cleanup);

const project = siloFeatureProject();
const step = project.tickets.find((t) => t.id === "e33") as TicketView;
const withPr: TicketView = {
  ...step,
  externalRefs: [
    {
      kind: "github_pr",
      url: "https://github.com/silo-labs/silo-location/pull/20",
      number: 20,
      state: "open",
      base: "dev",
      head: null,
      review: "changes_requested",
      checks: "error",
    },
  ],
};

test("no PR chip in the F · S line, no banner, Copier /full-delivery in the menu, no Copier la clé entry", async () => {
  render(
    <>
      <TicketTopBar
        projectId={project.meta.id}
        ticket={withPr}
        folder="/w/silo"
        launch
        actions={
          <TicketActionsMenu
            projectId={project.meta.id}
            ticket={withPr}
            childCount={0}
            editable
            onOpenInTab={() => undefined}
            onDeleted={() => undefined}
            questions={project.questions}
          />
        }
      />
      <TicketHeader project={project} ticket={withPr} />
    </>,
  );
  expect(screen.queryByText("PR #20")).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
  expect(await screen.findByRole("button", { name: "Lancer dans T3" })).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: `Actions ${withPr.keyLabel}` }));
  const items = (await screen.findAllByRole("menuitem")).map((i) => i.textContent);
  expect(items).toEqual([
    `Copier /full-delivery ${withPr.key}`,
    "Mettre en attente…",
    "Ouvrir dans un onglet",
    "Supprimer…",
  ]);
});

test("a ticket without a project folder explains it on the button", () => {
  render(<TicketTopBar projectId={project.meta.id} ticket={step} folder={null} launch actions={null} />);
  expect(screen.getByRole("button", { name: "Lancer dans T3" }).title).toBe("Relie le dossier du projet");
});
