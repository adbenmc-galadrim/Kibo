import { describe, expect, test } from "bun:test";
import { ProjectMeta, Question, SETUP_PAGES, Sprint, sprintPlan, Ticket } from "@kibo/schema";
import { emisShapedSnapshot } from "../../fixtures/emis-shaped";
import { isPlaced } from "./mapping";
import { readOldProject } from "./old-project";
import { buildRebasePlan, type RebasePlan } from "./plan-file";
import { QUESTION_PLACEMENT } from "./question-placement";
import { TODO_PLACEMENT } from "./todo-placement";
import { type FreshSnapshot, verifyRebase } from "./verify";

const old = readOldProject(emisShapedSnapshot());
const plan = buildRebasePlan({
  old,
  source: "getProject",
  merges: null,
  placement: TODO_PLACEMENT,
  overrides: QUESTION_PLACEMENT,
});
const mapping = plan.mapping;

const BLANK = {
  pendingSeq: null,
  blockedReason: null,
  domainId: null,
  assignee: null,
  delivery: null,
  optional: false,
};

function projectOf(p: RebasePlan) {
  const sprints = sprintPlan(p.setup).map((s, i) => Sprint.parse({ id: `s${i + 1}`, ...s }));
  const pages = SETUP_PAGES.map((page, i) => ({
    id: `p${i}`,
    title: page.title,
    kind: "view" as const,
    parentId: null,
  }));
  const instances = SETUP_PAGES.map((page, i) => ({
    id: `i${i}`,
    pageId: `p${i}`,
    component: page.component,
    layout: { x: 0, y: 0, w: 12, h: 8 },
    config: page.config,
    componentHash: null,
  }));
  const meta = ProjectMeta.parse({ id: "new", key: "EMIS", name: "Emis", folder: null, color: "#F97316" });
  const sprintOf = new Map(p.schedule.map((s) => [s.id, `s${s.sprint}`]));
  return { meta, sprints, pages, instances, sprintOf };
}

function freshOf(p: RebasePlan): FreshSnapshot {
  const m = p.mapping;
  const { sprintOf, ...project } = projectOf(p);
  const idOf = (key: string) => `n-${key}`;
  const tickets = m.features.flatMap((f) => [
    Ticket.parse({
      ...BLANK,
      id: idOf(f.shortKey),
      key: f.shortKey,
      shortKey: f.shortKey,
      title: f.title,
      description: f.ticket.description,
      statusId: "todo",
      parentId: null,
      externalRefs: f.ticket.refs,
      labels: f.labels,
      sprintId: sprintOf.get(f.shortKey) ?? null,
    }),
    ...f.steps.map((s) =>
      Ticket.parse({
        ...BLANK,
        id: idOf(s.newKey),
        key: s.newKey,
        title: s.title,
        description: s.ticket.description,
        statusId: s.ticket.statusId,
        blockedReason: s.ticket.blockedReason,
        parentId: idOf(f.shortKey),
        externalRefs: s.ticket.refs,
        labels: s.labels,
        delivery: s.ticket.delivery,
        optional: s.ticket.optional,
      }),
    ),
  ]);
  const links = m.links.map((l, i) => ({ id: `l${i}`, from: idOf(l.from), to: idOf(l.to), type: l.type }));
  const questions = m.questions.filter(isPlaced).map((q, i) =>
    Question.parse({
      id: `q${i}`,
      ticketId: idOf(m.keys.get(q.ticketOldKey) ?? ""),
      runId: null,
      title: q.old.title,
      context: q.old.context,
      options: [],
      provisional: null,
      blocking: q.old.blocking,
      createdBy: q.old.createdBy,
      createdAt: 1,
      importRef: q.old.importRef,
      answer: q.old.answer && { kind: "text", option: null, ...q.old.answer },
    }),
  );
  return { ...project, tickets, links, questions };
}

type Edit = (fresh: FreshSnapshot) => FreshSnapshot;
const editTicket =
  (key: string, patch: (t: Ticket) => Ticket): Edit =>
  (fresh) => ({ ...fresh, tickets: fresh.tickets.map((t) => (t.key === key ? patch(t) : t)) });
const problems = (edit: Edit) => verifyRebase(old, edit(freshOf(plan)), plan);
const stepOf = (oldKey: string) => {
  const step = mapping.features.flatMap((f) => f.steps).find((s) => s.ticket.planId === oldKey);
  if (!step) throw new Error(`no step ${oldKey}`);
  return step;
};

describe("verifyRebase", () => {
  test("a faithful rebase has no problem", () => {
    expect(verifyRebase(old, freshOf(plan), plan)).toEqual([]);
  });

  test("a different status names the new and the old key", () => {
    const s = stepOf("C0-5");
    const lines = problems(editTicket(s.newKey, (t) => ({ ...t, statusId: "todo", blockedReason: null })));
    expect(lines).toEqual([`${s.newKey} (ex ${s.oldKey}) : statut blocked attendu, todo trouvé`]);
  });

  test("a missing PR, branch or import ref is one line each", () => {
    const s = stepOf("C0-2");
    const lines = problems(editTicket(s.newKey, (t) => ({ ...t, externalRefs: [] })));
    expect(lines).toHaveLength(3);
    expect(lines.some((l) => l.includes("PR #1 merged"))).toBe(true);
    expect(lines.some((l) => l.includes("branche feat/c0-2 ← dev"))).toBe(true);
    expect(lines.some((l) => l.includes("import plan:C0-2"))).toBe(true);
  });

  test("a missing question is reported with its ticket", () => {
    const lines = problems((f) => ({ ...f, questions: f.questions.slice(1) }));
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines.some((l) => l.startsWith("question "))).toBe(true);
  });

  test("a missing link is reported by its new keys", () => {
    const [first] = mapping.links;
    if (!first) throw new Error("the fixture has links");
    const lines = problems((f) => ({ ...f, links: f.links.slice(1) }));
    expect(lines).toEqual([`lien ${first.from} → ${first.to} (${first.type}) manquant`]);
  });

  test("a sprint label left behind is reported", () => {
    const s = stepOf("C1-2");
    const lines = problems(editTicket(s.newKey, (t) => ({ ...t, labels: [...t.labels, "sprint:s2"] })));
    expect(lines).toContain(`${s.newKey} (ex ${s.oldKey}) : étiquette sprint:s2 restée`);
  });

  test("a gap in the step keys is reported", () => {
    const last = mapping.features.flatMap((f) => f.steps).at(-1);
    if (!last) throw new Error("the fixture has steps");
    const lines = problems(editTicket(last.newKey, (t) => ({ ...t, key: "EMIS-999" })));
    expect(lines).toContain("clés d'étapes non contiguës : EMIS-999 hors de EMIS-1..EMIS-83");
  });

  test("a feature without its F key is reported", () => {
    const lines = problems(editTicket("F3", (t) => ({ ...t, key: "EMIS-200", shortKey: null })));
    expect(lines).toContain(`F3 (ex ${mapping.features[2]?.oldKey}) : fonctionnalité sans clé F3`);
  });

  test("an assignee or a different description is reported", () => {
    const s = stepOf("C2-4");
    const lines = problems(
      editTicket(s.newKey, (t) => ({
        ...t,
        description: "autre",
        assignee: { kind: "agent", ref: "livraison" },
      })),
    );
    expect(lines).toHaveLength(2);
    expect(lines.some((l) => l.includes("description"))).toBe(true);
    expect(lines.some((l) => l.includes("assignee"))).toBe(true);
  });

  test("a feature in another sprint than the plan is reported", () => {
    const [first] = plan.schedule;
    if (!first) throw new Error("the fixture plans features");
    const feature = mapping.features.find((f) => f.shortKey === first.id);
    const lines = problems(editTicket(first.id, (t) => ({ ...t, sprintId: null })));
    expect(lines).toEqual([
      `${first.id} (ex ${feature?.oldKey}) : sprint S${first.sprint} attendu, aucun trouvé`,
    ]);
  });

  test("a different delivery note is reported", () => {
    const s = stepOf("C2-4");
    const lines = problems(
      editTicket(s.newKey, (t) => ({ ...t, delivery: t.delivery && { ...t.delivery, note: "autre" } })),
    );
    expect(lines).toEqual([
      `${s.newKey} (ex ${s.oldKey}) : note de livraison Code en cours attendu, autre trouvé`,
    ]);
  });

  test("a different client is reported", () => {
    const lines = problems((f) => ({ ...f, meta: { ...f.meta, client: "Autre" } }));
    expect(lines).toEqual(["client aucun attendu, Autre trouvé"]);
  });

  test("a missing page or instance is reported", () => {
    const lines = problems((f) => ({
      ...f,
      pages: f.pages.slice(0, 4),
      instances: f.instances.slice(0, 4),
    }));
    expect(lines).toContain(
      "pages : Vue d'ensemble, Planning, Kanban, Graphe, Questions attendues, Vue d'ensemble, Planning, Kanban, Graphe trouvées",
    );
    expect(lines).toContain("page Questions : questions@1.0.0 absent");
  });

  test("a missing or moved sprint is reported", () => {
    const lines = problems((f) => ({
      ...f,
      sprints: f.sprints.slice(1).map((s, i) => (i === 0 ? { ...s, end: s.start } : s)),
    }));
    const [first, second] = sprintPlan(plan.setup);
    expect(lines).toContain(`sprint ${first?.code} manquant`);
    expect(lines).toContain(
      `sprint ${second?.code} : ${second?.start} → ${second?.end} attendu, ${second?.start} → ${second?.start} trouvé`,
    );
  });
});
