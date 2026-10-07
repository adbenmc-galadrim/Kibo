import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import { KiboError } from "@kibo/schema";
import { z } from "zod";

const Lines = z.array(z.string()).default([]);

export const PlanStatus = z.enum(["todo", "wip", "review", "done", "blocked"]);
export type PlanStatus = z.infer<typeof PlanStatus>;

export const PlanPr = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  why: z.string().default(""),
  status: PlanStatus,
  deps: Lines,
  phase: z.string(),
  sprint: z.string(),
  areas: Lines,
  branch: z.string().optional(),
  pr: z.number().int().positive().nullable().optional(),
  note: z.string().optional(),
  perimetre: Lines,
  tests: Lines,
  pieges: Lines,
});
export type PlanPr = z.infer<typeof PlanPr>;

export const PlanQuestion = z.object({
  ref: z.string().min(1),
  blocks: z.string().default("—"),
  resolved: z.boolean().default(false),
  question: z.string().min(1),
});
export type PlanQuestion = z.infer<typeof PlanQuestion>;

export const EmisPlan = z.object({
  meta: z.object({
    title: z.string(),
    subtitle: z.string().default(""),
    updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    repo: z.string().url(),
    firstSprintDate: z.string().default(""),
    deadline: z.object({ label: z.string(), date: z.string(), note: z.string().default("") }).optional(),
    sources: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
  }),
  etat: z.object({ livre: Lines, manquant: Lines }),
  decisions: z.array(z.object({ id: z.string(), title: z.string(), body: Lines })),
  phases: z.array(
    z.object({ id: z.string(), label: z.string(), goal: z.string(), note: z.string().default("") }),
  ),
  chapters: z.array(
    z.object({ id: z.string().min(1), title: z.string().min(1), tagline: z.string(), prs: z.array(PlanPr) }),
  ),
  sprints: z.array(
    z.object({
      id: z.string(),
      from: z.string(),
      main: z.string().default(""),
      parallel: z.string().default(""),
    }),
  ),
  sprintNote: z.string().default(""),
  criticalPath: z.object({
    chains: z.array(
      // biome-ignore lint/suspicious/noThenProperty: champ du plan d'Emis
      z.object({ label: z.string(), steps: z.array(z.string()), then: z.string().default("") }),
    ),
    verrous: z.array(z.object({ label: z.string(), text: z.string() })).default([]),
  }),
  arbitrages: z.array(z.object({ group: z.string().min(1), tone: z.string(), items: z.array(PlanQuestion) })),
  process: Lines,
});
export type EmisPlan = z.infer<typeof EmisPlan>;
export type FlatPr = PlanPr & { chapter: string };

export const Answer = z.object({
  status: z.enum(["answered", "partial", "open"]),
  answer: z.string(),
  at: z.string(),
});
export const Answers = z.record(z.string(), Answer);
export type Answers = z.infer<typeof Answers>;

function evaluate(file: string): unknown {
  const sandbox: { window: Record<string, unknown> } = { window: {} };
  const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  try {
    new vm.Script(readFileSync(file, "utf8"), { filename: file }).runInContext(context, { timeout: 1000 });
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `${file} could not be evaluated: ${String(e)}`);
  }
  return sandbox.window.PLAN_DATA;
}

export function loadPlan(file: string): EmisPlan {
  const parsed = EmisPlan.safeParse(evaluate(file));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new KiboError("INVALID_INPUT", `${file} is not a plan: ${issues.slice(0, 5).join("; ")}`);
  }
  return Object.freeze(parsed.data);
}

export const flatPrs = (plan: EmisPlan): FlatPr[] =>
  plan.chapters.flatMap((c) => c.prs.map((p) => ({ ...p, chapter: c.id })));

export function loadAnswers(file: string): Answers {
  if (!existsSync(file)) return {};
  const parsed = Answers.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `${file} is not a valid answers file`);
  return parsed.data;
}
