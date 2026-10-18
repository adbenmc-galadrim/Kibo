import { describe, expect, test } from "bun:test";
import { emisShapedSnapshot } from "../../fixtures/emis-shaped";
import { type Mapping, mapProject, stripChapterPrefix } from "./mapping";
import { type OldProject, readOldProject } from "./old-project";
import { QUESTION_PLACEMENT } from "./question-placement";
import { TODO_PLACEMENT } from "./todo-placement";

const old = readOldProject(emisShapedSnapshot());
const mapping = mapProject(old, TODO_PLACEMENT, QUESTION_PLACEMENT);
const oldKeyOf = (planId: string) => old.tickets.find((t) => t.planId === planId)?.key ?? "";
const todoKeyOf = (id: string) =>
  old.tickets.find((t) => t.refs.some((r) => r.kind === "import_ref" && r.source === "todo" && r.id === id))
    ?.key ?? "";
const feature = (m: Mapping, chapter: string) => m.features.find((f) => f.chapter === chapter);
const steps = (m: Mapping) => m.features.flatMap((f) => f.steps);
const targetOf = (m: Mapping, id: string) =>
  m.questions.find((q) => q.old.importRef?.id === id)?.ticketOldKey;

function withQuestion(project: OldProject, patch: Partial<OldProject["questions"][number]>): OldProject {
  const base = project.questions[0];
  if (!base) throw new Error("fixture has questions");
  return { ...project, questions: [...project.questions, { ...base, id: "qx", ...patch }] };
}

describe("mapProject", () => {
  test("features F1…F15 follow the chapter order with titles stripped of their prefix", () => {
    expect(mapping.features.map((f) => f.shortKey)).toEqual(
      Array.from({ length: 15 }, (_, i) => `F${i + 1}`),
    );
    expect(mapping.features.map((f) => f.chapter)).toEqual([
      "C0",
      "C1",
      "C2",
      "C3",
      "C4",
      "C5",
      "C6",
      "C7",
      "C8",
      "C9",
      "CR",
      "CN",
      "CP",
      "CE",
      "CL",
    ]);
    expect(feature(mapping, "C0")?.title).toBe("Socle");
    expect(mapping.keys.get(oldKeyOf("C3"))).toBe("F4");
  });

  test("step keys are contiguous in feature then step order, features consume none", () => {
    expect(steps(mapping).map((s) => s.newKey)).toEqual(steps(mapping).map((_, i) => `EMIS-${i + 1}`));
    expect(
      feature(mapping, "C0")
        ?.steps.slice(0, 2)
        .map((s) => s.title),
    ).toEqual(["Étape 1 Socle", "Étape 2 Socle"]);
    expect(mapping.keys.get(oldKeyOf("C0-1"))).toBe("EMIS-1");
  });

  test("a TODO step goes last in its feature with fromTodo and no prefix", () => {
    const socle = feature(mapping, "C0")?.steps ?? [];
    expect(socle.slice(-2).map((s) => [s.title, s.fromTodo])).toEqual([
      ["Conflit de ports en local", true],
      ["Base de test partagée", true],
    ]);
    expect(feature(mapping, "C2")?.steps.at(-1)?.oldKey).toBe(todoKeyOf("PLAN-1"));
    expect(socle.filter((s) => !s.fromTodo)).toHaveLength(6);
  });

  test("DATA-1 and DATA-2 become client questions on their feature, not steps", () => {
    const keys = steps(mapping).map((s) => s.oldKey);
    expect(keys).not.toContain(todoKeyOf("DATA-1"));
    expect(targetOf(mapping, "DATA-1")).toBe(oldKeyOf("C3"));
    expect(targetOf(mapping, "DATA-2")).toBe(oldKeyOf("C5"));
    const data = mapping.questions.find((q) => q.old.importRef?.id === "DATA-1")?.old;
    expect(data).toMatchObject({
      title: "Liste fictive des sites à confirmer",
      context: "Description fictive de DATA-1.",
      blocking: true,
      recipient: "client",
      importRef: { kind: "import_ref", source: "todo", id: "DATA-1" },
    });
  });

  test("TODO and Arbitrages are dropped", () => {
    expect(mapping.dropped.map((d) => d.oldKey)).toEqual([oldKeyOf("arbitrages"), oldKeyOf("todo")]);
  });

  test("links are remapped and those touching Arbitrages or a question are listed as dropped", () => {
    const k = (planId: string) => mapping.keys.get(oldKeyOf(planId)) ?? "";
    expect(mapping.links).toContainEqual({ from: k("C2-5"), to: k("C3-1"), type: "blocks" });
    expect(mapping.links).toContainEqual({ from: k("C2"), to: k("C3"), type: "blocks" });
    expect(mapping.links).toContainEqual({ from: k("C4-1"), to: k("C3-3"), type: "relates" });
    expect(mapping.links).toContainEqual({
      from: mapping.keys.get(todoKeyOf("DEV-3")) ?? "",
      to: k("C9-1"),
      type: "blocks",
    });
    expect(mapping.droppedLinks.map((l) => [l.fromKey, l.toKey])).toEqual([
      [oldKeyOf("arbitrages"), oldKeyOf("C6-4")],
      [todoKeyOf("DATA-1"), oldKeyOf("C3-3")],
    ]);
  });

  test("questions follow their ticket, a blocked reason, a cited step, or stay unplaced", () => {
    expect(targetOf(mapping, "Q11")).toBe(oldKeyOf("C3-2"));
    expect(targetOf(mapping, "Q5")).toBe(oldKeyOf("C6-4"));
    expect(targetOf(mapping, "Q7")).toBe(oldKeyOf("CN-2"));
    expect(targetOf(mapping, "Q9")).toBe(oldKeyOf("C2-5"));
    const arbitrages = oldKeyOf("arbitrages");
    const orphan = withQuestion(old, {
      ticketKey: arbitrages,
      title: "Sans cible",
      context: "",
      importRef: null,
    });
    expect(mapProject(orphan, TODO_PLACEMENT, {}).questions.at(-1)?.ticketOldKey).toBe("unplaced");
    const cited = withQuestion(old, {
      ticketKey: arbitrages,
      title: "Voir C6",
      context: "",
      importRef: null,
    });
    expect(mapProject(cited, TODO_PLACEMENT, {}).questions.at(-1)?.ticketOldKey).toBe(oldKeyOf("C6"));
    const named = withQuestion(old, {
      ticketKey: arbitrages,
      title: "Sans cible",
      importRef: { kind: "import_ref", source: "plan", id: "Q42" },
    });
    expect(mapProject(named, TODO_PLACEMENT, { Q42: "C8-2" }).questions.at(-1)?.ticketOldKey).toBe(
      oldKeyOf("C8-2"),
    );
  });

  test("labels lose sprint and phase, and no assignee is carried", () => {
    const labels = steps(mapping).flatMap((s) => s.labels);
    expect(labels.some((l) => l.startsWith("sprint:") || l.startsWith("phase:"))).toBe(false);
    expect(labels).toContain("area:api");
    expect(JSON.stringify(mapping.features)).not.toContain("assignee");
  });

  test("a TODO ticket missing from the placement table is dropped and flagged", () => {
    const { "RFID-2": _, ...partial } = TODO_PLACEMENT;
    const m = mapProject(old, partial, QUESTION_PLACEMENT);
    expect(m.dropped.at(-1)).toEqual({
      oldKey: todoKeyOf("RFID-2"),
      why: "à placer : RFID-2 absent de todo-placement.ts",
    });
  });

  test("stripChapterPrefix removes chapter and step prefixes only", () => {
    expect(stripChapterPrefix("C2 · Modèle")).toBe("Modèle");
    expect(stripChapterPrefix("CE-3 · Rôles")).toBe("Rôles");
    expect(stripChapterPrefix("Revoir · les erreurs")).toBe("Revoir · les erreurs");
  });
});
