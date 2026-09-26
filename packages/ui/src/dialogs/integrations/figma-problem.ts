import { KiboError } from "@kibo/schema";
import { fr } from "../../i18n/fr";

const t = fr.integrations.figma;
const LACKS_TOOLS = /lacks tools: (.+)$/;

export type FigmaProblem = { tone: "error" | "warning"; title: string; detail: string };
type Failure = { code: string; message: string };

const addressOf = (url: string) => (URL.canParse(url) ? new URL(url).host : url);

function asFailure(e: unknown): Failure | null {
  if (e instanceof KiboError) return { code: e.code, message: e.detail };
  if (typeof e === "object" && e !== null && "code" in e && "message" in e)
    return { code: String(e.code), message: String(e.message) };
  return null;
}

const unreachable = (url: string): FigmaProblem => ({
  tone: "error",
  title: t.unreachable.title,
  detail: t.unreachable.detail(addressOf(url)),
});

export function figmaProblem(e: unknown, url: string): FigmaProblem {
  if (e === null) return unreachable(url);
  const failure = asFailure(e);
  if (failure === null) return { tone: "error", title: fr.common.error, detail: String(e) };
  if (failure.code === "MCP_FAILED") {
    const tools = LACKS_TOOLS.exec(failure.message)?.[1] ?? t.expectedTools;
    return { tone: "warning", title: t.missingTools.title, detail: t.missingTools.detail(tools) };
  }
  if (failure.code === "INVALID_INPUT") return { tone: "error", ...t.invalidUrl };
  return unreachable(url);
}
