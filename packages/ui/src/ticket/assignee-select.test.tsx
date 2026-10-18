import { afterEach, expect, test } from "bun:test";
import type { MemberInfo, TicketView } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emisFeatureProject } from "../shell/feature/fixture";
import { AssigneeSelect } from "./AssigneeSelect";

afterEach(cleanup);

const base = emisFeatureProject().tickets.find((t) => t.id === "e33") as TicketView;
const members: MemberInfo[] = [
  { userId: "adam", name: "Adam", role: "owner" },
  { userId: "lea", name: "Léa", role: "editor" },
];
const command = { run: async () => true, error: null, busy: false, clearError: () => undefined };
const draw = (ref: string | null, editable = true) =>
  render(
    <AssigneeSelect
      ticket={{ ...base, assignee: ref === null ? null : { kind: "human", ref } }}
      viewer="adam"
      members={members}
      editable={editable}
      command={command}
    />,
  );

test("the viewer reads « Adam (moi) » in the field and in the list", async () => {
  draw("adam");
  const field = screen.getByRole("combobox", { name: "Assigné" });
  expect(field.textContent).toContain("Adam (moi)");
  field.focus();
  await userEvent.setup().keyboard("{ArrowDown}");
  expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual([
    "Personne",
    "Adam (moi)",
    "Léa",
  ]);
});

test("a read-only field names the viewer the same way", () => {
  const { container } = draw("adam", false);
  expect(container.textContent).toBe("Adam (moi)");
});
