import { expect, test } from "bun:test";
import { PageKind, type ValidationReport } from "@kibo/schema";
import {
  assistantPrompt,
  draftKiboFiles,
  fixPrompt,
  generatorPrompt,
  STARTER_PLAN_JSON_SCHEMA,
} from "./prompts";

const brief = {
  mode: "create",
  componentId: "burndown",
  title: "Burndown",
  kind: "widget",
  withServer: false,
  description: "Burndown du sprint : tickets restants par jour.",
  baseVersion: null,
} as const;

test("the JSON schema follows StarterPlan", () => {
  const page = STARTER_PLAN_JSON_SCHEMA.properties.pages;
  expect(page.maxItems).toBe(8);
  expect(page.items.properties.kind.enum).toEqual(PageKind.options);
  expect(page.items.properties.title.maxLength).toBe(40);
});

test("assistantPrompt lists the catalog, the role and the text, and asks for JSON only", () => {
  const p = assistantPrompt({
    role: "designer",
    text: "Je suis freelance",
    catalog: [{ id: "kanban", title: "Kanban", description: "Tickets par statut", kind: "both" }],
  });
  expect(p).toContain("- kanban — Kanban — both — Tickets par statut");
  expect(p).toContain("Designer");
  expect(p).toContain("« Je suis freelance »");
  expect(p).toContain("Réponds uniquement par un objet JSON");
});

test("generatorPrompt states the task, the writable files and the test command", () => {
  const p = generatorPrompt(brief);
  expect(p).toContain(brief.description);
  expect(p).toContain("kibo component test .");
  expect(p).toContain("ui.tsx");
  expect(p).not.toContain("server.ts");
  expect(generatorPrompt({ ...brief, withServer: true })).toContain("server.ts");
  expect(generatorPrompt({ ...brief, mode: "modify", baseVersion: "0.1.0" })).toContain("burndown@0.1.0");
});

test("fixPrompt quotes only failing sections, truncated to their last 4000 characters", () => {
  const report: ValidationReport = {
    ok: false,
    manifest: { ok: true, errors: [] },
    imports: { ok: true, errors: [] },
    typecheck: { ok: false, errors: [`${"a".repeat(5000)}ui.tsx(3,7): error TS2322`] },
    tests: { ok: true, passed: 3, failed: 0, output: "3 pass" },
    conformance: { ok: true, errors: [] },
    permissions: { declared: [], used: [], missing: [], unused: [], errors: [] },
    hash: null,
  };
  const p = fixPrompt(report);
  expect(p).toContain("error TS2322");
  expect(p).not.toContain("3 pass");
  expect(p.length).toBeLessThan(4600);
});

test("draftKiboFiles writes the rules and the skill", () => {
  const files = draftKiboFiles(brief);
  expect(Object.keys(files).sort()).toEqual([".claude/skills/kibo-component/SKILL.md", "CLAUDE.md"]);
  expect(files["CLAUDE.md"]).toContain("runConformance");
  expect(files[".claude/skills/kibo-component/SKILL.md"]).toStartWith("---\nname: kibo-component\n");
});
