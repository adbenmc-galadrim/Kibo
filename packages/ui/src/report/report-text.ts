import type { Diagnostics, Environment } from "@kibo/schema";
import { systemLine, uptimeLabel } from "../about/about-text";
import { frReport as t } from "../i18n/fr-report";
import { SOURCE_URL } from "../lib/kibo-links";

export type ReportShell = "tauri" | "browser";
export type ReportOptions = { log: boolean };

export const ISSUE_URL = `${SOURCE_URL}/issues/new?template=probleme.yml&title=${encodeURIComponent(t.issueTitle)}`;

const item = (line: string) => `- ${line}`;

function claudeLine(ai: Environment["ai"]): string {
  if (!ai.available && ai.reason === "missing") return t.claudeMissing;
  return t.claude(ai.version, ai.loggedIn);
}

function fenced(lines: string[]): string {
  const body = lines.length > 0 ? lines.join("\n") : t.emptyLog;
  const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}\n${body}\n${fence}`;
}

function section(title: string, lines: string[]): string {
  return [title, ...lines].join("\n");
}

export function reportText(
  d: Diagnostics,
  shell: ReportShell,
  options: ReportOptions = { log: true },
): string {
  const env = d.environment;
  const sections = [
    t.heading,
    section(t.sections.app, [
      item(`${t.version(d.app.version)} · ${systemLine({ ...d.app, shell })}`),
      item(t.daemon(d.app.daemonPid, d.app.home, uptimeLabel(d.app.uptimeMs))),
    ]),
    section(t.sections.environment, [
      item(claudeLine(env.ai)),
      item(`${t.tool("git", env.git)} · ${t.tool("gh", env.gh)}`),
      item(t.capacity(env.capacity.cores, env.capacity.ramGb, env.capacity.hostSlots)),
    ]),
    section(t.sections.counts, [item(t.counts(d.counts))]),
    section(
      t.sections.integrations,
      d.integrations.length > 0
        ? d.integrations.map((i) => item(`${i.id} : ${i.state}`))
        : [item(t.noIntegration)],
    ),
  ];
  if (options.log) sections.push(section(t.sections.log, [fenced(d.log)]));
  return `${sections.join("\n\n")}\n`;
}
