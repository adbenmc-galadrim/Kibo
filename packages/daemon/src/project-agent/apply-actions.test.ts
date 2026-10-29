import { afterEach, expect, test } from "bun:test";
import type { ProposedAction } from "@kibo/schema";
import { planContext } from "../plan/plan-context";
import { runAction } from "./apply-actions";
import { type Harness, HUMAN, harness } from "./fakes.test-helper";

const open: Harness[] = [];
afterEach(() => {
  for (const h of open.splice(0)) h.close();
});

test("an agent or note action is refused without the agents port, before any write", async () => {
  const h = harness();
  open.push(h);
  const ticket = h.ticket("Tournée");
  const deps = {
    data: h.data,
    projectId: h.project.id,
    by: HUMAN,
    ctx: planContext(h.data, h.project.id),
    refs: new Map(),
  };
  const actions: ProposedAction[] = [
    { id: 1, why: "", type: "assignAgent", ticket: "SILO-1", profileId: "opus" },
    { id: 2, why: "", type: "createNote", path: "a.md", content: "# A\n" },
  ];
  for (const action of actions) {
    await expect(runAction(deps, action, { "SILO-1": ticket.id })).rejects.toMatchObject({
      code: "INTERNAL",
      detail: `${action.type} is not available outside a batch`,
    });
  }
  expect(h.commands).toEqual([]);
  expect(await h.data.notes(h.project.id)).toEqual([]);
});
