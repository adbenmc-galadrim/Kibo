import type {
  AiStatus,
  ComponentDraftDetails,
  ComponentManifest,
  FileDiff,
  PublishPreview,
  ValidationReport,
} from "@kibo/schema";

export const DRAFT_ID = "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11";

export const aiReady: AiStatus = {
  available: true,
  reason: null,
  version: "2.1.283",
  loggedIn: true,
  profiles: { assistant: true, generateur: true },
};

export const failingReport: ValidationReport = {
  ok: false,
  manifest: { ok: true, errors: [] },
  imports: { ok: true, errors: [] },
  typecheck: { ok: false, errors: ["ui.tsx(3,7): error TS2322"] },
  tests: { ok: true, passed: 1, failed: 0, output: "1 pass" },
  conformance: { ok: true, errors: [] },
  permissions: { declared: [], used: [], missing: [], unused: [], errors: [] },
  hash: null,
};

export function draftFixture(patch: Partial<ComponentDraftDetails>): ComponentDraftDetails {
  return {
    id: DRAFT_ID,
    componentId: "burndown",
    mode: "create",
    title: "Burndown",
    kind: "widget",
    withServer: false,
    baseVersion: null,
    description: "Burndown du sprint : tickets restants par jour.",
    runId: "run-7",
    sessionId: "s1",
    status: "generating",
    attempts: 1,
    failure: null,
    incidents: [],
    createdAt: 1,
    updatedAt: 1,
    report: null,
    diff: [],
    manifest: null,
    publish: null,
    ...patch,
  };
}

export const uiDiff: FileDiff = {
  path: "ui.tsx",
  origPath: null,
  binary: false,
  hunkStaging: false,
  additions: 1,
  deletions: 0,
  hunks: [
    {
      header: "@@ -0,0 +1 @@",
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: 1,
      section: "",
      lines: [{ kind: "add", text: "export function Burndown() {}", oldNo: null, newNo: 1, noEol: false }],
    },
  ],
};

export const burndownManifest: ComponentManifest = {
  id: "burndown",
  version: "0.1.0",
  kind: "widget",
  title: "Burndown",
  reads: ["ticket"],
  writes: [],
  data: false,
  net: [],
  secrets: [],
  mcp: [],
  configVersion: 0,
  changes: [],
  sdk: 1,
};

export const burndownPublish: PublishPreview = {
  id: "burndown",
  title: "Burndown",
  from: null,
  to: "0.1.0",
  hash: null,
  status: "new",
  usages: [],
  changes: [],
  newPermissions: ["read:ticket"],
  migration: null,
  validation: { ...failingReport, ok: true, typecheck: { ok: true, errors: [] } },
};
