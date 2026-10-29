import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PlanOutcome, PlanPreview, RpcRequest } from "@kibo/schema";
import { parseArgs } from "../args";
import { planCommand } from "./plan";
import { type FakeDaemonOptions, fakeDaemon } from "./tickets-test-kit";

const dir = mkdtempSync(join(tmpdir(), "kibo-plan-apply-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const PLAN = `summary: Tournée et dépôt
actions:
  - type: createTicket
    ref: new:1
    title: Tournée et dépôt
    feature: true
  - type: createTicket
    ref: new:2
    title: Lire le fichier
    parent: new:1
  - type: link
    from: SILO-33
    to: new:2
    kind: blocks
`;
writeFileSync(join(dir, "plan.yaml"), PLAN);
writeFileSync(
  join(dir, "sans-resume.json"),
  JSON.stringify({ actions: [{ type: "addRecipient", name: "dsi" }] }),
);
writeFileSync(join(dir, "casse.yaml"), "actions: [");
writeFileSync(
  join(dir, "faux.yaml"),
  "actions:\n  - type: assignAgent\n    ticket: SILO-33\n    profileId: dev\n",
);

const PREVIEW: PlanPreview = { ok: true, keys: { "new:1": "F8", "new:2": "SILO-101" } };
const PROBLEMS = [{ actionId: 3, type: "link", message: "ticket inconnu : SILO-999" }];
const DONE: PlanOutcome = {
  problems: [],
  results: [
    { actionId: 1, outcome: "applied", detail: null, created: { ticketId: "t-1", key: "SILO-100" } },
    { actionId: 2, outcome: "applied", detail: null, created: { ticketId: "t-2", key: "SILO-101" } },
    { actionId: 3, outcome: "applied", detail: null, created: null },
  ],
  created: [
    { ref: "new:1", ticketId: "t-1", key: "F8" },
    { ref: "new:2", ticketId: "t-2", key: "SILO-101" },
  ],
  stoppedAt: null,
};

async function applyWith(args: string[], options: FakeDaemonOptions = {}) {
  const d = fakeDaemon(undefined, undefined, options);
  const { positional, flags } = parseArgs(["plan", "apply", ...args]);
  const code = await planCommand(positional.slice(1), flags, d.io, d.connect, dir);
  const methods = d.calls.map((c) => c.method);
  return { ...d, code, methods };
}

const planRequest = (calls: RpcRequest[]) =>
  calls.find((c) => c.method === "previewPlan" || c.method === "applyPlan");

describe("kibo plan apply --dry-run", () => {
  test("calls previewPlan and prints one line per action, nothing else", async () => {
    const d = await applyWith(["plan.yaml", "--dry-run", "--project", "SILO"], {
      plan: { preview: PREVIEW },
    });
    expect(d.code).toBe(0);
    expect(d.err).toEqual([]);
    expect(d.methods).toEqual(["listProjects", "previewPlan"]);
    const sent = planRequest(d.calls);
    expect(sent).toMatchObject({ method: "previewPlan", projectId: "p-silo" });
    expect(sent && "actions" in sent ? sent.actions.map((a) => [a.id, a.type]) : []).toEqual([
      [1, "createTicket"],
      [2, "createTicket"],
      [3, "link"],
    ]);
    expect(d.out).toEqual([
      "Plan : Tournée et dépôt",
      "1. crée la fonctionnalité « Tournée et dépôt » → F8",
      "2. crée l'étape « Lire le fichier » sous new:1 (→ F8) → SILO-101",
      "3. SILO-33 bloque new:2 (→ SILO-101)",
      "3 actions, rien n'est écrit (--dry-run).",
    ]);
    expect(d.closed()).toBe(1);
  });

  test("names the plan after the file without a summary", async () => {
    const d = await applyWith(["sans-resume.json", "--dry-run", "--project", "SILO"], {
      plan: { preview: { ok: true, keys: {} } },
    });
    expect(d.code).toBe(0);
    expect(d.out).toEqual([
      "Plan : sans-resume.json",
      "1. ajoute le destinataire dsi",
      "1 action, rien n'est écrit (--dry-run).",
    ]);
  });

  test("an invalid plan lists the problems and exits 1", async () => {
    const d = await applyWith(["plan.yaml", "--dry-run", "--project", "SILO"], {
      plan: { preview: { ok: false, problems: PROBLEMS } },
    });
    expect(d.code).toBe(1);
    expect(d.out).toEqual([]);
    expect(d.err).toEqual([
      "Plan refusé : 1 problème, rien n'est écrit.",
      "#3 link : ticket inconnu : SILO-999",
    ]);
  });

  test("--json prints the preview", async () => {
    const d = await applyWith(["plan.yaml", "--dry-run", "--json", "--project", "SILO"], {
      plan: { preview: PREVIEW },
    });
    expect(d.code).toBe(0);
    expect(JSON.parse(d.out.join("\n"))).toEqual(PREVIEW);
  });
});

describe("kibo plan apply", () => {
  test("calls applyPlan and prints the results and the created keys", async () => {
    const d = await applyWith(["plan.yaml", "--project", "SILO"], { plan: { apply: DONE } });
    expect(d.code).toBe(0);
    expect(d.methods).toEqual(["listProjects", "applyPlan"]);
    expect(planRequest(d.calls)).toMatchObject({ method: "applyPlan", projectId: "p-silo" });
    expect(d.err).toEqual([]);
    expect(d.out).toEqual([
      "✓ 1. F8 créée : Tournée et dépôt",
      "✓ 2. SILO-101 créée : Lire le fichier",
      "✓ 3. SILO-33 bloque new:2 (→ SILO-101)",
      "Créés : new:1 → F8, new:2 → SILO-101",
    ]);
  });

  test("with problems nothing is written and it exits 1", async () => {
    const d = await applyWith(["plan.yaml", "--project", "SILO"], {
      plan: { apply: { problems: PROBLEMS, results: [], created: [], stoppedAt: null } },
    });
    expect(d.code).toBe(1);
    expect(d.out).toEqual([]);
    expect(d.err).toEqual([
      "Plan refusé : 1 problème, rien n'est écrit.",
      "#3 link : ticket inconnu : SILO-999",
    ]);
  });

  test("a stopped plan exits 1 and lists what was created", async () => {
    const stopped: PlanOutcome = {
      problems: [],
      results: [
        { actionId: 1, outcome: "applied", detail: null, created: { ticketId: "t-1", key: "SILO-100" } },
        { actionId: 2, outcome: "failed", detail: "boom", created: null },
        { actionId: 3, outcome: "skipped", detail: "arrêt après l'échec de #2", created: null },
      ],
      created: [{ ref: "new:1", ticketId: "t-1", key: "F8" }],
      stoppedAt: 2,
    };
    const d = await applyWith(["plan.yaml", "--project", "SILO"], { plan: { apply: stopped } });
    expect(d.code).toBe(1);
    expect(d.out).toEqual([
      "✓ 1. F8 créée : Tournée et dépôt",
      "✗ 2. crée l'étape « Lire le fichier » sous new:1 (→ F8) : boom",
      "– 3. ignorée : arrêt après l'échec de #2",
      "Créés : new:1 → F8",
      "Arrêt à l'action 2.",
    ]);
  });

  test("--json prints the outcome and keeps the exit code", async () => {
    const d = await applyWith(["plan.yaml", "--json", "--project", "SILO"], { plan: { apply: DONE } });
    expect(d.code).toBe(0);
    expect(JSON.parse(d.out.join("\n"))).toEqual(DONE);
    const refused = await applyWith(["plan.yaml", "--json", "--project", "SILO"], {
      plan: { apply: { problems: PROBLEMS, results: [], created: [], stoppedAt: null } },
    });
    expect(refused.code).toBe(1);
    expect(JSON.parse(refused.out.join("\n")).problems).toEqual(PROBLEMS);
  });
});

describe("kibo plan apply, the file", () => {
  test("a missing file is an error and the daemon is not called", async () => {
    const d = await applyWith(["absent.yaml", "--project", "SILO"]);
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Fichier introuvable : absent.yaml"]);
    expect(d.calls).toEqual([]);
  });

  test("a malformed YAML is an error", async () => {
    const d = await applyWith(["casse.yaml", "--project", "SILO"]);
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Plan illisible : YAML Parse error: Unexpected token"]);
    expect(d.calls).toEqual([]);
  });

  test("an action outside the plan is listed", async () => {
    const d = await applyWith(["faux.yaml", "--project", "SILO"]);
    expect(d.code).toBe(1);
    expect(d.err).toEqual(["Plan invalide :", "  action 1: type assignAgent is not allowed in a plan"]);
    expect(d.calls).toEqual([]);
  });

  test("without --project and outside a project folder it asks for the project", async () => {
    const d = await applyWith(["plan.yaml", "--dry-run"], { plan: { preview: PREVIEW } });
    expect(d.code).toBe(2);
    expect(d.err).toEqual(["précise --project SILO"]);
    expect(d.methods).toEqual(["listProjects"]);
  });

  test("a valueless --project is a usage error", async () => {
    const d = await applyWith(["plan.yaml", "--project"]);
    expect(d.code).toBe(2);
    expect(d.err.join("\n")).toContain("kibo plan apply");
    expect(d.calls).toEqual([]);
  });
});
