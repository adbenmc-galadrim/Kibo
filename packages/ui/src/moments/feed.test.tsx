import { expect, mock, test } from "bun:test";
import type { FileRef, MomentData, RunMoment } from "@kibo/schema";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NOW } from "../agents/fixtures";
import { formatClock } from "../agents/format";
import { frMoments } from "../i18n/fr-moments";
import {
  autoLinkFixture,
  autoLinkMoment,
  CANCELLED_AT,
  FIRST_SEEN,
  momentOf,
  OPEN_OVERLAP,
  OTHER_NAME,
  OTHER_RUN,
  OWNER_NAME,
  OWNER_RUN,
  overlapFixture,
  overlapMoment,
  RESOLVED_AT,
} from "../overlaps/fixtures";
import { Feed } from "./Feed";
import { actions, FEED_RUN, MOMENTS, PLAN, REPORT, SKILL_ACTIONS, WORKTREE } from "./fixtures";
import { PlanSteps } from "./PlanSteps";
import { ReportCard } from "./ReportCard";
import { CORRECTNESS, LAUNCH_MOMENTS } from "./subagent-fixtures";

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

test("a message is rendered as Markdown, never as raw HTML", async () => {
  const message = raw({ kind: "message", text: "Je corrige **receiver.ts** <img src=x onerror=alert(1)>" });
  const { container } = render(<Feed moments={[message]} texts={frMoments} />);
  expect((await screen.findByText("receiver.ts")).tagName).toBe("STRONG");
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

test("the exchange with the human is woven into the feed by time", () => {
  const extras = [
    { key: "q", at: nth(MOMENTS, 6).at + 1, kind: "question" as const, text: "Quel port ?" },
    { key: "a", at: nth(MOMENTS, 6).at + 2, kind: "human" as const, text: "4747,\npar défaut." },
    { key: "s", at: nth(MOMENTS, 0).at - 1, kind: "system" as const, text: "reprise de la session" },
  ];
  render(<Feed moments={MOMENTS} extras={extras} label="opus-dev-2" texts={frMoments} />);
  const items = Array.from(screen.getByRole("list", { name: "Fil de opus-dev-2" }).children);
  expect(items.at(0)?.textContent).toContain("reprise de la session");
  expect(items.at(-2)?.textContent).toContain("Quel port ?");
  expect(items.at(-1)?.getAttribute("data-kind")).toBe("human");
  expect(screen.getByText("4747, par défaut.", { normalizer: (t) => t.replace(/\s+/g, " ") })).toBeTruthy();
});

test("a labelled feed keeps its list even before the first moment", () => {
  render(<Feed moments={[]} label="opus-dev-2" texts={frMoments} />);
  expect(screen.getByRole("list", { name: "Fil de opus-dev-2" })).toBeTruthy();
  expect(screen.getByText("Rien dans le fil pour l'instant.")).toBeTruthy();
});

test("a signal moment names the kind and the title, and opens the signal box", async () => {
  const opened: string[] = [];
  const signal = raw({
    kind: "signal",
    signalId: "s1",
    ref: "sig:1",
    signalKind: "ticket",
    title: "Tests du récepteur de hooks",
  });
  render(<Feed moments={[signal]} texts={frMoments} onOpenSignal={(id) => opened.push(id)} />);
  const line = screen.getByRole("button", {
    name: /Signal à l'agent de projet · Ticket à créer · « Tests du récepteur de hooks »/,
  });
  await userEvent.setup().click(line);
  expect(opened).toEqual(["s1"]);
});

test("without a handler the signal moment is plain text", () => {
  const signal = raw({
    kind: "signal",
    signalId: "s2",
    ref: "sig:2",
    signalKind: "blocker",
    title: "Attend KIB-12",
  });
  render(<Feed moments={[signal]} texts={frMoments} />);
  expect(screen.getByText("Signal à l'agent de projet · Blocage · « Attend KIB-12 »")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});

test("screen 196: skills used, refused and reviewed read as sentences", async () => {
  render(<Feed moments={[raw(actions(SKILL_ACTIONS))]} texts={frMoments} />);
  await userEvent.setup().click(groupButton(0));
  const rows = screen.getAllByRole("listitem").filter((li) => li.hasAttribute("data-outcome"));
  expect(rows.map((r) => r.querySelector("[data-phrase]")?.textContent)).toEqual([
    "A utilisé le skill brainstorming",
    "Kibo a refusé le skill deploy",
    "Kibo a refusé le sous-agent seo",
    "A laissé une review de 2 skills skill_review",
  ]);
  expect(within(nth(rows, 0)).getByText("Skill")).toBeTruthy();
  expect(within(nth(rows, 1)).getByLabelText("refusé")).toBeTruthy();
  expect(within(nth(rows, 0)).getByText("brainstorming").tagName).toBe("CODE");
});

test("the skills reminders say what Kibo asked", () => {
  render(
    <Feed
      moments={[
        raw({ kind: "reminder", reminder: "skills" }),
        { ...raw({ kind: "reminder", reminder: "report_skills" }), seq: 100 },
      ]}
      texts={frMoments}
    />,
  );
  expect(screen.getByText("Kibo a rappelé la review des skills")).toBeTruthy();
  expect(screen.getByText("Kibo a rappelé le compte rendu et la review des skills")).toBeTruthy();
});

test("screen 196: a skill use and a refusal each stand on their own line, the refusal in red", () => {
  const used = nth(SKILL_ACTIONS, 0);
  const refused = nth(SKILL_ACTIONS, 1);
  render(
    <Feed
      moments={[raw(actions([used])), { ...raw(actions([refused])), id: 100, seq: 100 }]}
      texts={frMoments}
    />,
  );
  const line = screen.getByRole("button", { name: "A utilisé le skill brainstorming" });
  expect(within(line).getByText("brainstorming").tagName).toBe("CODE");
  const refusal = screen.getByRole("button", { name: "Kibo a refusé le skill deploy" });
  expect(refusal.className).toContain("text-destructive");
});

const overlapFeed = (props: Partial<Parameters<typeof Feed>[0]> = {}) => {
  const seen = {
    files: [] as string[],
    ignored: [] as string[],
    cancelled: [] as string[],
    tickets: [] as string[],
  };
  render(
    <Feed
      moments={[momentOf(1, FIRST_SEEN, overlapMoment())]}
      texts={frMoments}
      overlaps={new Map([["o1", OPEN_OVERLAP]])}
      canEdit
      onSeeFiles={(id) => seen.files.push(id)}
      onIgnoreOverlap={(id) => seen.ignored.push(id)}
      onCancelAutoLink={(id) => seen.cancelled.push(id)}
      onOpenTicketKey={(key) => seen.tickets.push(key)}
      now={NOW}
      {...props}
    />,
  );
  return seen;
};

test("screen 197: an overlap names the other run, what overlaps, the role and the state", async () => {
  const seen = overlapFeed();
  const line = document.querySelector("[data-overlap]");
  if (!(line instanceof HTMLElement)) throw new Error("no overlap line");
  expect(line.querySelector("svg.lucide-copy")).toBeTruthy();
  expect(within(line).getByRole("button", { name: OWNER_NAME })).toBeTruthy();
  expect(within(line).getByText("formatDate").tagName).toBe("CODE");
  expect(line.textContent).toContain("formatDate exporté deux fois");
  expect(line.textContent).toContain("src/utils/date.ts (toi) · src/lib/format.ts");
  expect(within(line).getByText("information")).toBeTruthy();
  expect(within(line).queryByText("à factoriser")).toBeNull();
  expect(within(line).getByText("Ouvert")).toBeTruthy();
  const user = userEvent.setup();
  await user.click(within(line).getByRole("button", { name: "Voir les fichiers" }));
  await user.click(within(line).getByRole("button", { name: "Ignorer" }));
  expect(seen.files).toEqual(["o1"]);
  expect(seen.ignored).toEqual(["o1"]);
});

test("screen 197b: the owner reads who reuses its code, and a resolved overlap cannot be ignored", () => {
  overlapFeed({
    moments: [
      momentOf(
        1,
        FIRST_SEEN,
        overlapMoment({ role: "owner", withRunId: OTHER_RUN, withRunName: OTHER_NAME }),
        OWNER_RUN,
      ),
    ],
    overlaps: new Map([["o1", overlapFixture({ status: "resolved", resolvedAt: RESOLVED_AT })]]),
  });
  expect(screen.getByText(`repris par ${OTHER_NAME}`)).toBeTruthy();
  expect(screen.getByText(`Réglé ${formatClock(RESOLVED_AT)}`)).toBeTruthy();
  expect(screen.getByText("src/lib/format.ts").closest("span")?.textContent).toContain(
    "src/lib/format.ts (toi) · src/utils/date.ts",
  );
  expect(screen.queryByRole("button", { name: "Ignorer" })).toBeNull();
});

test("an ignored overlap says who ignored it, without any button to ignore", () => {
  overlapFeed({
    overlaps: new Map([
      [
        "o1",
        overlapFixture({
          status: "ignored",
          ignoredBy: { kind: "human", ref: "Adam" },
          ignoredAt: RESOLVED_AT,
        }),
      ],
    ]),
  });
  expect(screen.getByText("Ignoré par Adam")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Ignorer" })).toBeNull();
});

test("a reader who cannot edit sees no ignore button, and an unknown overlap waits", () => {
  overlapFeed({ canEdit: false });
  expect(screen.queryByRole("button", { name: "Ignorer" })).toBeNull();
  cleanup();
  overlapFeed({ overlaps: new Map() });
  expect(screen.getByText("…")).toBeTruthy();
  expect(screen.getByText(/formatDate.*exporté deux fois/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Ignorer" })).toBeNull();
});

test("screen 198: an automatic link names both tickets, the file reused, and can be cancelled", async () => {
  const seen = overlapFeed({
    moments: [momentOf(2, RESOLVED_AT, autoLinkMoment())],
    autoLinks: new Map([["a1", autoLinkFixture()]]),
  });
  const line = document.querySelector("[data-auto-link]");
  if (!(line instanceof HTMLElement)) throw new Error("no link line");
  expect(line.querySelector("svg.lucide-link")).toBeTruthy();
  expect(line.textContent).toContain("Kibo a lié BOU-12 → BOU-15 (BOU-12 bloque BOU-15)");
  expect(line.textContent).toContain("src/lib/format-date.ts repris de BOU-12");
  const user = userEvent.setup();
  await user.click(within(line).getByRole("button", { name: "BOU-12" }));
  await user.click(within(line).getByRole("button", { name: "Annuler" }));
  expect(seen.tickets).toEqual(["BOU-12"]);
  expect(seen.cancelled).toEqual(["a1"]);
});

test("screen 198b: a cancelled link says who cancelled it and when, without a button", () => {
  overlapFeed({
    moments: [momentOf(2, RESOLVED_AT, autoLinkMoment())],
    autoLinks: new Map([
      [
        "a1",
        autoLinkFixture({
          status: "cancelled",
          cancelledBy: { kind: "human", ref: "Adam" },
          cancelledAt: CANCELLED_AT,
        }),
      ],
    ]),
  });
  expect(screen.getByText(`Annulé par Adam ${formatClock(CANCELLED_AT)}`)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Annuler" })).toBeNull();
});

test("a link refused for a cycle says so, with no button", () => {
  overlapFeed({
    moments: [momentOf(2, RESOLVED_AT, autoLinkMoment({ autoLinkId: null, failure: "cycle" }))],
  });
  const line = screen.getByText("Kibo n'a pas pu lier BOU-12 → BOU-15 : dépendance circulaire");
  expect(line.querySelector("svg.lucide-ban")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});

test("the overlap reminder and the peek at another run read as sentences", () => {
  const peek = actions([
    {
      tool: "mcp__kibo__peek_work",
      kind: "mcp",
      label: "A regardé le travail de `BOU-12`",
      target: "peek_work",
      outcome: "ok",
      detail: null,
      patch: null,
      tests: null,
    },
  ]);
  render(
    <Feed
      moments={[raw({ kind: "reminder", reminder: "overlap" }), { ...raw(peek), seq: 100 }]}
      texts={frMoments}
    />,
  );
  expect(screen.getByText("Kibo a rappelé de factoriser")).toBeTruthy();
  expect(screen.getByText("A regardé le travail de `BOU-12`")).toBeTruthy();
});

test("no moment of a sub-agent ever shows in the main feed", () => {
  render(
    <Feed moments={LAUNCH_MOMENTS} subagents={new Map([[CORRECTNESS.id, CORRECTNESS]])} texts={frMoments} />,
  );
  expect(screen.queryByText(/sign-in\.tsx/)).toBeNull();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByRole("button", { name: /^Sous-agent ecc:code-reviewer/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: "A lu 1 fichier" })).toBeTruthy();
});
