import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type RpcRequest } from "@kibo/schema";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../../api-mock";
import { splitHeld, stepModels } from "./feature-model";
import { NOW, siloHeldProject } from "./fixture";

const calls: RpcRequest[] = [];
mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        calls.push(req);
        return null;
      },
    },
  }),
);

const { HeldSteps } = await import("./HeldSteps");

beforeEach(() => {
  calls.length = 0;
});
afterEach(cleanup);

const { held } = splitHeld(stepModels(siloHeldProject(), "f5", { ciRuns: [], now: NOW }));
const opened: string[] = [];
const draw = (editable = true) =>
  render(
    <HeldSteps
      projectId="silo"
      steps={held}
      workflow={DEFAULT_WORKFLOW}
      editable={editable}
      onOpenTicket={(id) => void opened.push(id)}
    />,
  );

test("the steps on hold are grouped under « En attente · 3 »", () => {
  draw();
  const section = screen.getByRole("region", { name: "En attente · 3" });
  expect(within(section).getByText("la fonctionnalité avance sans elles")).toBeTruthy();
  const rows = within(section).getAllByRole("listitem");
  expect(rows.map((r) => r.getAttribute("data-ticket"))).toEqual(["SILO-33", "SILO-34", "SILO-35"]);
  const own = within(rows[0] as HTMLElement);
  expect(own.getByText("Serveur MinIO de recette indisponible · depuis le 16 oct.")).toBeTruthy();
  expect(own.getByText("En cours")).toBeTruthy();
  expect(own.getByRole("button", { name: "Reprendre" })).toBeTruthy();
  for (const row of rows.slice(1)) {
    expect(within(row).getByText("attend SILO-33")).toBeTruthy();
    expect(within(row).queryByRole("button", { name: "Reprendre" })).toBeNull();
  }
});

test("« Reprendre » lifts the hold of its step and the title opens it", async () => {
  draw();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Reprendre" }));
  await waitFor(() =>
    expect(calls.flatMap((c) => (c.method === "command" ? [c.command] : []))).toEqual([
      { method: "setHold", ticketId: "e33", reason: null },
    ]),
  );
  opened.length = 0;
  await user.click(screen.getByRole("button", { name: "Tests E2E de l'envoi" }));
  expect(opened).toEqual(["e34"]);
});

test("a reader cannot resume a step", () => {
  draw(false);
  expect(screen.queryByRole("button", { name: "Reprendre" })).toBeNull();
});

test("the pause marks of the title, the dots and the own reason are cyan, the status dot keeps its status", () => {
  draw();
  const section = screen.getByRole("region", { name: "En attente · 3" });
  const title = section.querySelector("div > .lucide-pause");
  expect(title?.getAttribute("class")).toContain("text-(--tracking-hold)");
  const rows = within(section).getAllByRole("listitem");
  for (const row of rows) {
    const dot = row.firstElementChild;
    expect(dot?.className).toContain("bg-(--tracking-hold-soft)");
    expect(dot?.querySelector(".lucide-pause")?.getAttribute("class")).toContain("text-(--tracking-hold)");
  }
  const reason = within(rows[0] as HTMLElement).getByText(/Serveur MinIO/).previousElementSibling;
  expect(reason?.getAttribute("class")).toContain("text-(--tracking-hold)");
  expect(within(rows[0] as HTMLElement).getByText("En cours").previousElementSibling?.className).toContain(
    "bg-(--tracking-blue)",
  );
});
