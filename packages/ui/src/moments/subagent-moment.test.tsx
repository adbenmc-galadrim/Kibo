import { afterEach, expect, mock, test } from "bun:test";
import type { RpcRequest, RunMoment, RunMomentsEvent, RunSubagent } from "@kibo/schema";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NOW } from "../agents/fixtures";
import { apiMock } from "../api-mock";
import { frMoments } from "../i18n/fr-moments";
import { FEED_RUN } from "./fixtures";
import {
  CONVENTIONS,
  CORRECTNESS,
  CORRECTNESS_ID,
  CORRECTNESS_PROMPT,
  FAILED,
  launchMoment,
  nestedMoment,
  subagentMoment,
} from "./subagent-fixtures";

const calls: RpcRequest[] = [];
const listeners = new Set<(event: RunMomentsEvent) => void>();

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "runs.subagentMoments")
          return Promise.resolve({
            moments: [nestedMoment(1, req.subagentId)],
            internalPlan: null,
            partial: null,
            source: "transcript",
          });
        return Promise.reject(new Error(`unexpected ${req.method}`));
      },
      subscribeMoments: (listener: (event: RunMomentsEvent) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  }),
);

const { Feed } = await import("./Feed");

afterEach(() => {
  cleanup();
  calls.length = 0;
});

const index = (list: readonly RunSubagent[]) => new Map(list.map((s) => [s.id, s]));

function show(moments: RunMoment[], subagents: readonly RunSubagent[]) {
  render(<Feed moments={moments} subagents={index(subagents)} now={NOW} texts={frMoments} />);
}

const RUNNING_LINE = "Sous-agent ecc:code-reviewer · Porte qualité — correctness · en cours depuis 2 min";

test("a running sub-agent is one folded line, its type in orange beside a bot icon", () => {
  show([subagentMoment(CORRECTNESS)], [CORRECTNESS]);
  const line = screen.getByRole("button", { name: RUNNING_LINE });
  expect(line.getAttribute("aria-expanded")).toBe("false");
  expect(line.querySelector("svg.lucide-bot")).not.toBeNull();
  expect(within(line).getByText("ecc:code-reviewer").className).toContain("text-brand");
  expect(screen.queryByText(CORRECTNESS_PROMPT)).toBeNull();
  expect(calls).toEqual([]);
});

test("unfolded, the line shows its state, a folded prompt and its own actions loaded on demand", async () => {
  show([subagentMoment(CORRECTNESS)], [CORRECTNESS]);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: RUNNING_LINE }));
  expect(screen.getByText("en cours · 4 actions")).toBeTruthy();
  expect(screen.getByText("sonnet (demandé)")).toBeTruthy();
  expect(screen.queryByText(CORRECTNESS_PROMPT)).toBeNull();
  await user.click(screen.getByRole("button", { name: /Voir le prompt/ }));
  expect(screen.getByText(CORRECTNESS_PROMPT)).toBeTruthy();
  const nested = await screen.findByRole("region", { name: "Actions du sous-agent ecc:code-reviewer" });
  expect(within(nested).getByRole("button", { name: /^A lu 1 fichier/ })).toBeTruthy();
  expect(calls).toEqual([{ method: "runs.subagentMoments", runId: FEED_RUN, subagentId: CORRECTNESS_ID }]);
});

test("the nested feed follows the moments pushed for its sub-agent only", async () => {
  show([subagentMoment(CORRECTNESS)], [CORRECTNESS]);
  await userEvent.setup().click(screen.getByRole("button", { name: RUNNING_LINE }));
  const nested = await screen.findByRole("region", { name: "Actions du sous-agent ecc:code-reviewer" });
  act(() => {
    for (const l of listeners)
      l({ type: "run.moments", runId: FEED_RUN, moments: [nestedMoment(7), nestedMoment(8, "other")] });
  });
  expect(within(nested).getAllByRole("button", { name: /^A lu 1 fichier/ })).toHaveLength(2);
});

test("a finished sub-agent says how long it took and keeps its summary when folded", () => {
  show([subagentMoment(CONVENTIONS)], [CONVENTIONS]);
  expect(
    screen.getByRole("button", {
      name: "Sous-agent ecc:code-reviewer · Porte qualité — conventions · terminé en 4 min",
    }),
  ).toBeTruthy();
  expect(screen.getByText(`Résumé : ${CONVENTIONS.result}`)).toBeTruthy();
});

test("a failed sub-agent says « échec » in red", () => {
  show([subagentMoment(FAILED)], [FAILED]);
  const line = screen.getByRole("button", { name: "Sous-agent seo · Audit SEO · échec" });
  expect(within(line).getByText("échec").className).toContain("text-destructive");
});

test("the launch action gives way to the sub-agent line once the sub-agent is known", () => {
  show([launchMoment(CORRECTNESS), subagentMoment(CORRECTNESS)], [CORRECTNESS]);
  expect(screen.queryByRole("button", { name: /^A lancé un sous-agent/ })).toBeNull();
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
});

test("without a matching sub-agent, today's launch action is left as it is", () => {
  show([launchMoment(CORRECTNESS), subagentMoment(CORRECTNESS)], []);
  expect(screen.getByRole("button", { name: "A lancé un sous-agent ecc:code-reviewer" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: RUNNING_LINE })).toBeNull();
});
