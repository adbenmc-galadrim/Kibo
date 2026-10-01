import { expect, test } from "bun:test";
import { PageKind, type ValidationReport } from "@kibo/schema";
import {
  assistantPrompt,
  draftKiboFiles,
  fixPrompt,
  generatorPrompt,
  revisePrompt,
  STARTER_PLAN_JSON_SCHEMA,
} from "./prompts";
import { EXAMPLE_COMPONENT, formatTable, SKILL } from "./prompts-skill";

const brief = {
  mode: "create",
  componentId: "burndown",
  title: "Burndown",
  kind: "widget",
  withServer: false,
  description: "Burndown du sprint : tickets restants par jour.",
  baseVersion: null,
  formats: ["medium", "large", "half"],
  attachments: [],
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

test("draftKiboFiles writes the rules, the skill and the example", () => {
  const files = draftKiboFiles(brief);
  expect(files["CLAUDE.md"]).toContain("runConformance");
  expect(files["CLAUDE.md"]).toContain(".claude/skills/kibo-component/exemple.tsx");
  expect(files[".claude/skills/kibo-component/SKILL.md"]).toStartWith("---\nname: kibo-component\n");
  expect(files[".claude/skills/kibo-component/exemple.tsx"]).toBe(EXAMPLE_COMPONENT);
});

test("the generator prompt names the declared formats, the attachments and the example", () => {
  const p = generatorPrompt({
    ...brief,
    formats: ["medium", "half"],
    attachments: ["/h/d.attachments/1-maquette.png"],
  });
  expect(p).toContain("Formats à prendre en charge : medium (Moyen, 6 × 3");
  expect(p).toContain("half (Demi-page, 12 × 6");
  expect(p).not.toContain("small (");
  expect(p).toContain("Maquettes jointes");
  expect(p).toContain("/h/d.attachments/1-maquette.png");
  expect(p).toContain("exemple.tsx");
  expect(p.match(/1-maquette\.png/g)).toHaveLength(1);
});

test("the kibo files carry the skill with formats, tokens, responsive rules and the example", () => {
  const files = draftKiboFiles({ ...brief, formats: ["large"], attachments: [] });
  expect(Object.keys(files).sort()).toEqual([
    ".claude/skills/kibo-component/SKILL.md",
    ".claude/skills/kibo-component/exemple.tsx",
    "CLAUDE.md",
  ]);
  const skill = files[".claude/skills/kibo-component/SKILL.md"] ?? "";
  for (const needle of [
    "sdk.format",
    "@container",
    "@md:",
    "bg-card",
    "text-muted-foreground",
    "largeur fixe",
    "Petit",
    "Plein écran",
    "1200 px",
  ])
    expect(skill).toContain(needle);
  expect(files[".claude/skills/kibo-component/exemple.tsx"]).toContain('useEntities("ticket")');
});

test("the format table gives cells and pixels at 1200 px and marks the declared formats", () => {
  const table = formatTable(["medium", "full"]);
  expect(table).toContain("| small | Petit | 3 × 3 | ≈ 288 × 272 px | non |");
  expect(table).toContain("| medium | Moyen | 6 × 3 | ≈ 592 × 272 px | oui |");
  expect(table).toContain("| large | Large | 6 × 6 | ≈ 592 × 560 px | non |");
  expect(table).toContain("| half | Demi-page | 12 × 6 | ≈ 1200 × 560 px | non |");
  expect(table).toContain("| full | Plein écran | 12 × 9 | ≈ 1200 × 848 px | oui |");
  expect(SKILL).toContain("colonne ≈ 85 px");
});

test("revisePrompt carries the feedback, the new images and the test order", () => {
  const p = revisePrompt(brief, "Mets le total en gros", ["/h/d.attachments/2-b.png"]);
  expect(p).toContain("Retour de l'utilisateur après aperçu : « Mets le total en gros »");
  expect(p).toContain("/h/d.attachments/2-b.png");
  expect(p).toContain("kibo component test .");
  expect(p).toContain("Formats à prendre en charge : medium (Moyen");
  expect(p.match(/2-b\.png/g)).toHaveLength(1);
});

test("the prompts never carry a path outside the draft, the SDK and the images, nor a secret", () => {
  const texts = [
    generatorPrompt({ ...brief, attachments: ["/h/d.attachments/1-a.png"] }),
    revisePrompt(brief, "Mets le total en gros", []),
    ...Object.values(draftKiboFiles(brief)),
  ].join("\n");
  expect(texts).not.toMatch(/KIBO_RUN_TOKEN|kibo_session|token|\/Users\/|\/home\//i);
  const absolute = texts.match(/(?<![\w@.:/-])\/[\w.-]+\/[\w./-]*/g) ?? [];
  expect(absolute.filter((p) => !p.startsWith("/h/d.attachments/"))).toEqual([]);
});
