import { afterEach, expect, test } from "bun:test";
import type { ComponentManifestInput, ProjectCommand, Ticket, TicketView } from "@kibo/schema";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useDeliverFlow } from "./deliver-flow";
import { createMockSdk } from "./mock";
import { SdkProvider, useEntities } from "./react";

afterEach(cleanup);

const manifest: ComponentManifestInput = {
  id: "probe",
  version: "1.0.0",
  kind: "view",
  title: "Probe",
  reads: ["ticket", "run"],
  writes: ["ticket", "run"],
};

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const parent = run({ method: "createTicket", title: "Regroupement" }) as Ticket;
  run({ method: "createTicket", title: "Feuille A", parentId: parent.id });
  run({ method: "createTicket", title: "Feuille B", parentId: parent.id });
  run({ method: "createTicket", title: "Seul" });
};

function Probe() {
  const { data } = useEntities("ticket");
  const flow = useDeliverFlow();
  const byTitle = (title: string) => data.find((t) => t.title === title) as TicketView;
  return (
    <>
      {data.length > 0 && (
        <>
          <button type="button" onClick={() => flow.deliver(byTitle("Seul"))}>
            seul
          </button>
          <button type="button" onClick={() => flow.deliver(byTitle("Regroupement"))}>
            parent
          </button>
          <button
            type="button"
            onClick={() => flow.deliver({ id: "absent", keyLabel: "KIB-99", title: "?" })}
          >
            absent
          </button>
        </>
      )}
      {flow.error && <p role="alert">{flow.error}</p>}
      {flow.dialog}
    </>
  );
}

const setup = () => {
  const m = createMockSdk(manifest, { seed });
  render(
    <SdkProvider sdk={m.sdk}>
      <Probe />
    </SdkProvider>,
  );
  return m;
};

test("delivering a leaf asks the SDK for one run and opens nothing", async () => {
  const m = setup();
  await userEvent.setup().click(await screen.findByRole("button", { name: "seul" }));
  await waitFor(() => expect(m.runDeliveries).toHaveLength(1));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("a parent opens the dialog of its ready sub-tickets, delivered in order", async () => {
  const m = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "parent" }));
  const dialog = await screen.findByRole("dialog", { name: "Livrer les sous-tickets de KIB-1" });
  expect(dialog).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Livrer 2 tickets" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const keys = m.runDeliveries.map((id) => m.snapshot().tickets.find((t) => t.id === id)?.key);
  expect(keys).toEqual(["KIB-1", "KIB-2", "KIB-3"]);
});

test("a refusal is reported with the ticket key", async () => {
  setup();
  await userEvent.setup().click(await screen.findByRole("button", { name: "absent" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Échec de la livraison de KIB-99 : la livraison n'a pas démarré",
  );
});

test("the update mode reaches the delivery with the touch-up brief", async () => {
  const m = createMockSdk(manifest, { seed });
  const seul = m.snapshot().tickets.find((t) => t.title === "Seul");
  const result = await m.sdk.runs.deliver(seul?.id ?? "", "update");
  expect("brief" in result ? result.brief : null).toBe(`/update-delivery ${seul?.keyLabel}`);
});
