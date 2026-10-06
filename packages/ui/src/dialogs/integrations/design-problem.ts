import { KiboError } from "@kibo/schema";
import { fr } from "../../i18n/fr";
import { frDesign } from "../../i18n/fr-design";

const t = frDesign.connect;
const LACKS_TOOLS = /lacks tools: (.+)$/;

export type ConnectMode = "figma-token" | "figma-mcp" | "penpot";
export type ConnectProblem = {
  tone: "error" | "warning";
  title: string;
  detail: string;
  field: "token" | "address" | null;
};
type Failure = { code: string; message: string };

const addressOf = (url: string) => (URL.canParse(url) ? new URL(url).host : url);

function asFailure(e: unknown): Failure | null {
  if (e instanceof KiboError) return { code: e.code, message: e.detail };
  if (typeof e === "object" && e !== null && "code" in e && "message" in e)
    return { code: String(e.code), message: String(e.message) };
  return null;
}

const UNREACHABLE = {
  "figma-token": { text: t.figma.unreachableToken, field: null },
  "figma-mcp": { text: t.figma.unreachable, field: "address" },
  penpot: { text: t.penpot.unreachable, field: "address" },
} as const;

function unreachable(mode: ConnectMode, address: string): ConnectProblem {
  const { text, field } = UNREACHABLE[mode];
  return { tone: "error", title: text.title, detail: text.detail(addressOf(address)), field };
}

function missingTools(message: string): ConnectProblem {
  const tools = LACKS_TOOLS.exec(message)?.[1] ?? t.figma.expectedTools;
  return {
    tone: "warning",
    title: t.figma.missingTools.title,
    detail: t.figma.missingTools.detail(tools),
    field: "address",
  };
}

export function connectProblem(mode: ConnectMode, e: unknown, address: string): ConnectProblem {
  if (e === null) return unreachable(mode, address);
  const failure = asFailure(e);
  if (failure === null) return { tone: "error", title: fr.common.error, detail: String(e), field: null };
  switch (failure.code) {
    case "REMOTE_REJECTED":
      return { tone: "error", ...t.refused, field: "token" };
    case "TOKEN_IGNORED":
      return { tone: "error", ...t.penpot.tokenIgnored, field: "token" };
    case "MCP_FAILED":
      return missingTools(failure.message);
    case "INVALID_INPUT":
      return { tone: "error", ...t.invalidUrl, field: "address" };
    case "SECRET_STORE_UNAVAILABLE":
      return { tone: "error", title: fr.integrations.keychainUnavailable, detail: "", field: null };
    default:
      return unreachable(mode, address);
  }
}
