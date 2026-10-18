import { afterEach, expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { siloFeatureProject } from "../shell/feature/fixture";
import { OptionalToggle } from "./OptionalToggle";
import type { TicketCommand } from "./use-ticket-command";

afterEach(cleanup);

const sent: ProjectCommand[] = [];
const command: TicketCommand = {
  run: async (c) => {
    sent.push(c);
    return true;
  },
  error: null,
  busy: false,
  clearError: () => undefined,
};

const find = (id: string) => {
  const t = siloFeatureProject().tickets.find((x) => x.id === id);
  if (!t) throw new Error(`fixture without ${id}`);
  return t;
};

test("a required step is checked and unchecking makes it optional", async () => {
  sent.length = 0;
  render(<OptionalToggle ticket={find("e35")} editable command={command} />);
  const toggle = screen.getByRole("switch", { name: "Requise pour livrer" });
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  expect(screen.getByText("Requise pour livrer")).toBeTruthy();
  await userEvent.setup().click(toggle);
  expect(sent).toEqual([{ method: "setTicketOptional", ticketId: "e35", optional: true }]);
});

test("an optional step is unchecked and checking makes it required again", async () => {
  sent.length = 0;
  render(<OptionalToggle ticket={{ ...find("e35"), optional: true }} editable command={command} />);
  const toggle = screen.getByRole("switch", { name: "Requise pour livrer" });
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  await userEvent.setup().click(toggle);
  expect(sent).toEqual([{ method: "setTicketOptional", ticketId: "e35", optional: false }]);
});

test("a root ticket has no optional toggle", () => {
  render(<OptionalToggle ticket={find("f5")} editable command={command} />);
  expect(screen.queryByRole("switch")).toBeNull();
});

test("a reader sees the toggle disabled", () => {
  render(<OptionalToggle ticket={find("e35")} editable={false} command={command} />);
  expect(screen.getByRole("switch", { name: "Requise pour livrer" }).hasAttribute("disabled")).toBe(true);
});
