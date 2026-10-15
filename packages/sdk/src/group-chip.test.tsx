import { afterEach, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GroupChip, groupOfTicket } from "./group-chip";

afterEach(cleanup);

const group = { id: "g", keyLabel: "EMIS-4", title: "Parcours de livraison" };

test("the chip shows the key of the group in zinc, its title on hover, and opens it", () => {
  const onOpen = mock((_id: string) => undefined);
  render(<GroupChip group={group} onOpen={onOpen} />);
  const chip = screen.getByRole("button", { name: "Ouvrir l'ensemble EMIS-4 · Parcours de livraison" });
  expect(chip.textContent).toBe("EMIS-4");
  expect(chip.getAttribute("title")).toBe("EMIS-4 · Parcours de livraison");
  expect(chip.className).toContain("zinc");
  expect(chip.className).not.toContain("brand");
  fireEvent.click(chip);
  expect(onOpen).toHaveBeenCalledWith("g");
});

test("the group of a ticket is its parent", () => {
  const tickets = [
    { ...group, parentId: null },
    { id: "a", keyLabel: "EMIS-5", title: "A", parentId: "g" },
  ];
  const [parent, child] = tickets;
  if (!parent || !child) throw new Error("fixture");
  const of = groupOfTicket(tickets);
  expect(of(child)).toBe(parent);
  expect(of(parent)).toBeNull();
});
