import { expect, mock, test } from "bun:test";
import type { FileRef, MomentData, RunMoment } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { frMoments } from "../i18n/fr-moments";
import { Feed } from "./Feed";
import { FEED_RUN, MOMENTS, PLAN, REPORT, WORKTREE } from "./fixtures";
import { PlanSteps } from "./PlanSteps";
import { ReportCard } from "./ReportCard";

const files = { projectId: "kibo", worktree: WORKTREE, origin: "KIB-14 · opus-dev-2" };

function nth<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no item ${index}`);
  return item;
}

const groupButton = (index: number) => nth(screen.getAllByRole("button", { name: /^A / }), index);

const raw = (data: MomentData): RunMoment => ({
  id: 99,
  runId: FEED_RUN,
  seq: 99,
  at: 0,
  stepId: null,
  data,
});

test("a message is rendered as Markdown, never as raw HTML", () => {
  const message = raw({ kind: "message", text: "Je corrige **receiver.ts** <img src=x onerror=alert(1)>" });
  const { container } = render(<Feed moments={[message]} texts={frMoments} />);
  expect(container.querySelector("strong")?.textContent).toBe("receiver.ts");
  expect(container.querySelector("img")).toBeNull();
});

test("a group of actions is folded behind its summary, red when one failed", async () => {
  render(<Feed moments={MOMENTS} texts={frMoments} />);
  const groups = screen.getAllByRole("button", { name: /^A / });
  expect(groups.map((g) => g.closest("[data-failed]")?.getAttribute("data-failed"))).toEqual([
    "false",
    "true",
  ]);
  expect(screen.queryByText("packages/daemon/src/hooks/receiver.test.ts")).toBeNull();
  await userEvent.setup().click(nth(groups, 0));
  const rows = screen.getAllByRole("listitem").filter((li) => li.hasAttribute("data-outcome"));
  expect(rows.map((r) => r.getAttribute("data-outcome"))).toEqual(["ok", "ok"]);
  expect(within(nth(rows, 0)).getByText("Lu")).toBeTruthy();
});

test("a failed action shows its outcome, its counts and its detail in a pre block", async () => {
  render(<Feed moments={MOMENTS} texts={frMoments} />);
  const user = userEvent.setup();
  await user.click(groupButton(1));
  const failed = screen.getAllByRole("listitem").find((li) => li.getAttribute("data-outcome") === "error");
  if (!failed) throw new Error("no failed action");
  expect(within(failed).getByLabelText("en échec")).toBeTruthy();
  expect(within(failed).getByText("12 ✓ 1 ✗")).toBeTruthy();
  await user.click(within(failed).getByText("Voir le détail"));
  expect(failed.querySelector("pre")?.textContent).toContain("1 fail");
  expect(screen.getByText("+8 −3")).toBeTruthy();
});

test("a target that looks like a path opens the file in the run's worktree", async () => {
  const onOpenFile = mock((_: FileRef) => {});
  render(<Feed moments={MOMENTS} texts={frMoments} files={files} onOpenFile={onOpenFile} />);
  const user = userEvent.setup();
  await user.click(groupButton(1));
  await user.click(screen.getByRole("button", { name: "packages/daemon/src/hooks/receiver.ts" }));
  expect(onOpenFile.mock.calls).toEqual([
    [
      {
        projectId: "kibo",
        worktree: WORKTREE,
        path: "packages/daemon/src/hooks/receiver.ts",
        line: null,
        origin: "KIB-14 · opus-dev-2",
      },
    ],
  ]);
  expect(screen.queryByRole("button", { name: "bun test packages/daemon/src/hooks" })).toBeNull();
});

test("without a worktree the targets stay plain text", async () => {
  render(<Feed moments={MOMENTS} texts={frMoments} />);
  await userEvent.setup().click(groupButton(0));
  expect(screen.getByText("packages/daemon/src/hooks/receiver.ts").tagName).toBe("SPAN");
});

test("a reminder says what Kibo asked, a raw line is muted, a partial feed says why", () => {
  render(
    <Feed
      moments={[
        nth(MOMENTS, 0),
        raw({ kind: "raw", text: '{"type":"weird"}', partial: null }),
        { ...raw({ kind: "raw", text: "", partial: "unreadable" }), seq: 100 },
      ]}
      texts={frMoments}
    />,
  );
  expect(screen.getByText("Kibo a rappelé de déclarer le plan")).toBeTruthy();
  expect(screen.getByText('{"type":"weird"}').className).toContain("font-mono");
  expect(screen.getByText("Fil partiel : transcription illisible")).toBeTruthy();
});

test("the reasoning is hidden unless asked for", () => {
  const view = render(<Feed moments={MOMENTS} texts={frMoments} />);
  expect(screen.queryByText(/le test ne couvre que null/)).toBeNull();
  view.rerender(<Feed moments={MOMENTS} texts={frMoments} showReasoning />);
  expect(screen.getByText(/le test ne couvre que null/)).toBeTruthy();
});

test("the moments of the highlighted step are marked, and carry their step number", () => {
  const { container } = render(<Feed moments={MOMENTS} texts={frMoments} steps={PLAN} highlightStep="s2" />);
  const current = Array.from(container.querySelectorAll("[data-step-current]")).map((el) =>
    el.getAttribute("data-seq"),
  );
  expect(current).toEqual(["4", "6", "7"]);
  expect(screen.getAllByText("Étape 2")).toHaveLength(2);
});

test("an empty feed says so", () => {
  render(<Feed moments={[]} texts={frMoments} />);
  expect(screen.getByText("Rien dans le fil pour l'instant.")).toBeTruthy();
});

test("the report lists what was done, the decisions, what to check, the files and what's next", () => {
  render(<ReportCard report={REPORT} />);
  expect(screen.getByText("Fait")).toBeTruthy();
  expect(screen.getByText(REPORT.done)).toBeTruthy();
  expect(screen.getByText("Port 4747 par défaut, écrit dans ~/.kibo/daemon.json")).toBeTruthy();
  expect(screen.getByText("À vérifier (2)")).toBeTruthy();
  expect(screen.getByText("Fichiers (2)")).toBeTruthy();
  expect(screen.getByText("1 fichier modifié non mentionné")).toBeTruthy();
  expect(screen.getByText("1 fichier cité sans modification")).toBeTruthy();
  expect(screen.getByText("Suite")).toBeTruthy();
  expect(screen.queryByText("fichiers non vérifiés")).toBeNull();
});

test("a report without a file check says the files were not checked", () => {
  render(<ReportCard report={{ ...REPORT, check: null }} />);
  expect(screen.getByText("fichiers non vérifiés")).toBeTruthy();
});

test("a run without report says so", () => {
  render(<ReportCard report={null} />);
  expect(screen.getByText("Pas de compte rendu pour ce run")).toBeTruthy();
});

test("the plan lists its steps with their state, and a step can be picked", async () => {
  const onStep = mock((_: string) => {});
  render(<PlanSteps plan={PLAN} internal={false} onStep={onStep} />);
  const steps = screen.getAllByRole("button");
  expect(steps.map((s) => s.getAttribute("data-status"))).toEqual([
    "done",
    "doing",
    "todo",
    "blocked",
    "todo",
  ]);
  expect(screen.getByText("attend KIB-12")).toBeTruthy();
  expect(screen.queryByText("plan interne de l'agent")).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: /Corriger la validation du corps/ }));
  expect(onStep).toHaveBeenCalledWith("s2");
});

test("an internal plan says it is the agent's own list", () => {
  render(<PlanSteps plan={PLAN} internal />);
  expect(screen.getByText("plan interne de l'agent")).toBeTruthy();
});
