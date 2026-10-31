import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import type { DiffLabels } from "./batch-groups";
import { ConversationView } from "./ConversationView";

afterEach(cleanup);

const LABELS: DiffLabels = {
  status: (id) => id,
  ticket: () => null,
  question: () => null,
  recipient: (r) => r,
};

const TABLE = [
  "| Ordre | Ticket | Attend |",
  "|---|---|---|",
  "| 1 | SILO-15, compte non provisionné (écran 1.2) | SILO-14 |",
  "| 2 | SILO-76, back-office utilisateurs (écran 10.0) | SILO-15 |",
].join("\n");

async function expectTable(scope: HTMLElement) {
  const table = await within(scope).findByRole("table");
  expect(table.querySelectorAll("tbody tr")).toHaveLength(2);
  return table;
}

test("the project agent chat shows tables with ticket keys that open the ticket", async () => {
  const opened: string[] = [];
  const { container } = render(
    <ConversationView
      items={[{ kind: "agent", id: "a", at: 0, text: TABLE, read: [] }]}
      status="ready"
      readOnly={false}
      labels={LABELS}
      onTicket={(key) => opened.push(key)}
      onRetry={() => {}}
      onResend={() => {}}
      onDecide={async () => {}}
    />,
  );
  const table = await expectTable(container);
  fireEvent.click(within(table).getByRole("button", { name: "SILO-14" }));
  expect(opened).toEqual(["SILO-14"]);
});
