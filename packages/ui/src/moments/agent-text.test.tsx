import { afterEach, expect, test } from "bun:test";
import type { MomentData, RunMoment } from "@kibo/schema";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { frMoments } from "../i18n/fr-moments";
import type { DiffLabels } from "../project-agent/batch-groups";
import { ConversationView } from "../project-agent/ConversationView";
import { Feed } from "./Feed";
import { FEED_RUN, REPORT } from "./fixtures";
import { ReportCard } from "./ReportCard";

afterEach(cleanup);

const LABELS: DiffLabels = {
  status: (id) => id,
  ticket: () => null,
  profile: (id) => id,
  question: () => null,
  recipient: (r) => r,
};

const TABLE = [
  "| Ordre | Ticket | Attend |",
  "|---|---|---|",
  "| 1 | SILO-15, compte non provisionné (écran 1.2) | SILO-14 |",
  "| 2 | SILO-76, back-office utilisateurs (écran 10.0) | SILO-15 |",
].join("\n");

const moment = (data: MomentData): RunMoment => ({
  id: 1,
  runId: FEED_RUN,
  seq: 1,
  at: 0,
  stepId: null,
  data,
});

async function expectTable(scope: HTMLElement) {
  const table = await within(scope).findByRole("table");
  expect(table.querySelectorAll("tbody tr")).toHaveLength(2);
  return table;
}

test("a message moment shows its table, and Agrandir opens the sheet", async () => {
  const { container } = render(
    <Feed moments={[moment({ kind: "message", text: TABLE })]} texts={frMoments} />,
  );
  await expectTable(container);
  fireEvent.click(screen.getByRole("button", { name: "Agrandir le tableau" }));
  const sheet = await screen.findByRole("dialog", { name: "Tableau" });
  expect(within(sheet).getByRole("button", { name: "Copier en Markdown" })).toBeDefined();
});

test("an agent question in the run thread renders its Markdown", async () => {
  const { container } = render(
    <Feed moments={[]} extras={[{ key: "q", at: 0, kind: "question", text: TABLE }]} texts={frMoments} />,
  );
  await expectTable(container);
});

test("the final report renders Markdown in what was done and what comes next", async () => {
  const { container } = render(
    <ReportCard report={{ ...REPORT, done: TABLE, next: "**Brancher** le démon" }} />,
  );
  await expectTable(container);
  expect(container.querySelector("strong")?.textContent).toBe("Brancher");
});

test("the project agent chat shows tables with ticket keys that open the ticket", async () => {
  const opened: string[] = [];
  const { container } = render(
    <ConversationView
      items={[{ kind: "agent", id: "a", at: 0, text: TABLE }]}
      readOnly={false}
      labels={LABELS}
      signals={[]}
      onTicket={(key) => opened.push(key)}
      onRetry={() => {}}
      onDecide={async () => {}}
    />,
  );
  const table = await expectTable(container);
  fireEvent.click(within(table).getByRole("button", { name: "SILO-14" }));
  expect(opened).toEqual(["SILO-14"]);
});
