import { expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentList } from "./AgentList";
import type { AgentListItem } from "./agent-list";

const items: AgentListItem[] = [
  { runId: "r3", label: "Fais le point du jour", date: "14:20", messages: 4, current: true },
  { runId: "r1", label: "Relances client", date: "2 oct.", messages: 3, current: false },
];

test("the list offers a new agent first, marks the current one and opens a past one", async () => {
  const onOpen = mock((_runId: string) => {});
  const onNew = mock(() => {});
  const { container } = render(
    <AgentList items={items} selected="r3" canReset onOpen={onOpen} onNew={onNew} />,
  );
  const nav = screen.getByRole("navigation", { name: "Agents" });
  expect(screen.getAllByRole("button")[0]?.textContent).toBe("Nouvel agent");
  const current = container.querySelector('[aria-current="true"]');
  expect(current?.textContent).toContain("Fais le point du jour");
  expect(current?.textContent).toContain("en cours");
  expect(nav.textContent).toContain("3 messages");
  await userEvent.click(screen.getByRole("button", { name: /^Relances client/ }));
  expect(onOpen).toHaveBeenCalledWith("r1");
  await userEvent.click(screen.getByRole("button", { name: "Nouvel agent" }));
  expect(onNew).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Fermer la liste" })).toBeNull();
});

test("Nouvel agent is disabled without an open session, Fermer la liste shows when it can close", async () => {
  const onClose = mock(() => {});
  render(
    <AgentList
      items={items}
      selected="r1"
      canReset={false}
      onOpen={() => {}}
      onNew={() => {}}
      onClose={onClose}
    />,
  );
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Nouvel agent" }).disabled).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Fermer la liste" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("an empty list says so", () => {
  render(<AgentList items={[]} selected={null} canReset onOpen={() => {}} onNew={() => {}} />);
  expect(screen.getByText("Aucun agent pour ce projet.")).toBeTruthy();
});
