import { expect, test } from "bun:test";
import { parseReviewDecision, prChecksTone } from "../../packages/schema/src/pr-checks";
import { emisGhState } from "./emis-gh";
import { EMIS_LOOSE_TICKETS, emisSteps, prUrl } from "./emis-maquettes";
import { EMIS_CLOSING } from "./emis-suivi";

const followed = [...emisSteps(), ...EMIS_LOOSE_TICKETS].flatMap((s) =>
  s.pr !== undefined && (s.pr.state === "open" || s.pr.number === EMIS_CLOSING.merged) ? [s.pr] : [],
);

test("the fake gh knows every followed pull request with the review and CI of the fixture", () => {
  const state = emisGhState({ merged: false });
  expect(state.map((p) => p.number).sort((a, b) => a - b)).toEqual(
    followed.map((p) => p.number).sort((a, b) => a - b),
  );
  for (const pr of followed) {
    const fake = state.find((p) => p.number === pr.number);
    expect(fake).toMatchObject({ url: prUrl(pr.number), state: "OPEN", isDraft: false });
    expect(parseReviewDecision(fake?.reviewDecision)).toBe(pr.review);
    expect(prChecksTone(fake?.statusCheckRollup ?? [])).toBe(pr.checks);
  }
});

test("once merged, only the closing pull request changes state", () => {
  const before = emisGhState({ merged: false });
  const after = emisGhState({ merged: true });
  const changed = after.filter((p, i) => JSON.stringify(p) !== JSON.stringify(before[i]));
  expect(changed.map((p) => [p.number, p.state])).toEqual([[EMIS_CLOSING.merged, "MERGED"]]);
  expect(changed.map((p) => ({ ...p, state: "OPEN" }))).toEqual(
    before.filter((p) => p.number === EMIS_CLOSING.merged),
  );
});
