import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AppInfo, Diagnostics } from "@kibo/schema";
import { ISSUE_URL, reportText } from "./report-text";

const app: AppInfo = {
  version: "1.5.0",
  platform: "darwin",
  arch: "arm64",
  home: "~/.kibo",
  daemonPid: 42,
  uptimeMs: 65_000,
};

const DIAG: Diagnostics = {
  app,
  environment: {
    daemon: { address: "127.0.0.1:4317", home: "~/.kibo" },
    ai: {
      available: true,
      reason: null,
      version: "2.1.283",
      loggedIn: true,
      profiles: { assistant: true, generateur: true },
    },
    git: "2.46",
    gh: null,
    capacity: { cores: 8, ramGb: 16, hostSlots: 3 },
    github: { connected: false },
    app,
  },
  counts: { projects: 2, tickets: 10, components: 7, instances: 4, profiles: 3 },
  integrations: [{ id: "github", state: "disconnected" }],
  log: ["[kibo-daemon] pair failed token=[redacted] at ~/.kibo/x", "[kibo-daemon] second"],
};

test("reportText is markdown with fixed sections and never includes raw objects", () => {
  const text = reportText(DIAG, "tauri");
  expect(text).toContain("## Application\n- Kibo 1.5.0 · macOS · Apple Silicon · application de bureau");
  expect(text).toContain("- Démon : PID 42 · ~/.kibo · en marche depuis 1 min");
  expect(text).toContain("## Environnement\n- claude 2.1.283 · connecté\n- git 2.46 · gh introuvable");
  expect(text).toContain("- 8 cœurs · 16 Go de mémoire · 3 créneaux");
  expect(text).toContain("## Contenu\n- 2 projets · 10 tickets · 7 composants · 4 instances · 3 profils");
  expect(text).toContain("## Intégrations\n- github : disconnected");
  expect(text).toContain(
    "## Journal (50 dernières lignes)\n```\n[kibo-daemon] pair failed token=[redacted] at ~/.kibo/x\n[kibo-daemon] second\n```",
  );
  expect(text).not.toContain("[object Object]");
  expect(text).not.toContain("127.0.0.1");
});

test("singulars, a missing or logged out claude, no integration and an empty log read naturally", () => {
  const text = reportText(
    {
      ...DIAG,
      environment: {
        ...DIAG.environment,
        ai: { ...DIAG.environment.ai, available: false, reason: "missing", version: null, loggedIn: null },
        git: null,
        gh: "2.60",
        capacity: { cores: 1, ramGb: 8, hostSlots: 1 },
      },
      counts: { projects: 1, tickets: 1, components: 1, instances: 1, profiles: 1 },
      integrations: [],
      log: [],
    },
    "browser",
  );
  expect(text).toContain("- Kibo 1.5.0 · macOS · Apple Silicon · navigateur");
  expect(text).toContain("- claude introuvable\n- git introuvable · gh 2.60");
  expect(text).toContain("- 1 cœur · 8 Go de mémoire · 1 créneau");
  expect(text).toContain("- 1 projet · 1 ticket · 1 composant · 1 instance · 1 profil");
  expect(text).toContain("## Intégrations\n- aucune");
  expect(text).toContain("## Journal (50 dernières lignes)\n```\n(vide)\n```");
  const loggedOut = reportText(
    { ...DIAG, environment: { ...DIAG.environment, ai: { ...DIAG.environment.ai, loggedIn: false } } },
    "tauri",
  );
  expect(loggedOut).toContain("- claude 2.1.283 · non connecté");
});

test("a log line with a code fence cannot close the journal block", () => {
  const text = reportText({ ...DIAG, log: ["before ``` after"] }, "tauri");
  expect(text).toContain("````\nbefore ``` after\n````");
});

test("the report can leave the journal out", () => {
  const text = reportText(DIAG, "tauri", { log: false });
  expect(text).not.toContain("Journal");
  expect(text).not.toContain("pair failed");
});

test("the issue URL opens the template with a title and never carries a report", () => {
  const url = new URL(ISSUE_URL);
  expect(`${url.origin}${url.pathname}`).toBe("https://github.com/adbenmc-galadrim/Kibo/issues/new");
  expect(url.searchParams.get("template")).toBe("probleme.yml");
  expect(url.searchParams.get("title")).toBe("Problème : ");
  expect([...url.searchParams.keys()]).toEqual(["template", "title"]);
});

test("the issue template named by the URL exists and asks for the report and the no-secret check", () => {
  const template = readFileSync(
    join(import.meta.dir, "../../../../.github/ISSUE_TEMPLATE/probleme.yml"),
    "utf8",
  );
  expect(template).toContain("render: markdown");
  expect(template).toContain("Je confirme que le rapport ne contient aucun secret");
});
