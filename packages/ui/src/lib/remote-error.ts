import { type IntegrationId, type IntegrationStatus, KiboError, type KiboErrorCode } from "@kibo/schema";
import { fr } from "../i18n/fr";

type IntegrationError = NonNullable<IntegrationStatus["error"]>;

const t = fr.integrations.errors;
const GITHUB_ANSWER = /^github (\d{3})(?:: ([\s\S]*))?$/;
const CODES: Partial<Record<KiboErrorCode, string>> = t.codes;

function githubPhrase(detail: string): string {
  for (const [en, french] of Object.entries(t.githubPhrases)) {
    if (!detail.startsWith(en)) continue;
    const rest = detail.slice(en.length).replace(/^[:\s]+/, "");
    return rest ? `${french} (${rest})` : french;
  }
  return detail;
}

function githubAnswer(status: number, detail: string | undefined): string {
  if (status === 401) return t.githubDetail(status, t.reconnect);
  return detail ? t.githubDetail(status, githubPhrase(detail.trim())) : t.githubStatus(status);
}

export function remoteErrorText(code: KiboErrorCode, message: string): string {
  const answer = GITHUB_ANSWER.exec(message);
  if (answer?.[1]) return githubAnswer(Number(answer[1]), answer[2]);
  return CODES[code] ?? fr.common.error;
}

export function failureText(e: unknown): string {
  return e instanceof KiboError ? remoteErrorText(e.code, e.detail) : fr.common.error;
}

export function integrationErrorText(id: IntegrationId, error: IntegrationError): string {
  if (id === "mcp" && error.code === "MCP_UNAVAILABLE") return t.mcpServers(error.message.split(", "));
  if (id === "figma" && error.code === "MCP_UNAVAILABLE") return t.figmaUnreachable;
  if (id === "figma" && error.code === "NOT_CONNECTED") return t.figmaNotConnected;
  if (id === "git" && error.code === "NOT_FOUND") return t.gitMissing;
  return remoteErrorText(error.code, error.message);
}
