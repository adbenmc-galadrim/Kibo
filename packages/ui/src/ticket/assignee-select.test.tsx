import { afterEach, expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { siloFeatureProject } from "../shell/feature/fixture";
import { AssigneeSelect } from "./AssigneeSelect";

afterEach(cleanup);

const base = siloFeatureProject().tickets.find((t) => t.id === "e33") as TicketView;
const command = { run: async () => true, error: null, busy: false, clearError: () => undefined };
const draw = (ref: string | null, editable = true) =>
  render(
    <AssigneeSelect
      ticket={{ ...base, assignee: ref === null ? null : { kind: "human", ref } }}
      viewer="adam"
      editable={editable}
      command={command}
    />,
  );

test("the viewer reads « Moi » in the field and in the list", async () => {
  draw("adam");
  const field = screen.getByRole("combobox", { name: "Assigné" });
  expect(field.textContent).toContain("Moi");
  field.focus();
  await userEvent.setup().keyboard("{ArrowDown}");
  expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["Personne", "Moi"]);
});

test("a read-only field names the viewer the same way", () => {
  const { container } = draw("adam", false);
  expect(container.textContent).toBe("Moi");
});
