import {
  type DesignProvider,
  designUrlProblem,
  frameProblemOf,
  KiboError,
  parseDesignUrl,
} from "@kibo/schema";
import { frDesign } from "../../i18n/fr-design";
import { failureText } from "../../lib/remote-error";
import { type DesignRef, refProvider } from "./design-refs";

type ProblemKind = keyof typeof frDesign.problems;

const hostOf = (url: string): string => (URL.canParse(url) ? new URL(url).host : "");
const providerOf = (url: string): DesignProvider => parseDesignUrl(url)?.key.provider ?? "figma";
const text = (kind: ProblemKind, provider: DesignProvider, host: string, code: string): string =>
  frDesign.problems[kind]({ provider, name: frDesign.provider[provider], host, code });

export function frameErrorText(e: unknown, node: DesignRef): string {
  const provider = refProvider(node);
  const problem = frameProblemOf(e, provider);
  return text(problem.kind, provider, hostOf(node.url), problem.code ?? "");
}

export function linkErrorText(e: unknown, url: string): string {
  if (!(e instanceof KiboError)) return failureText(e);
  if (e.code === "INVALID_INPUT") {
    const problem = designUrlProblem(url);
    return problem ? frDesign.urlProblems[problem] : text("otherInstance", "penpot", hostOf(url), e.code);
  }
  if (e.code === "NOT_CONNECTED") return text("notConnected", providerOf(url), hostOf(url), e.code);
  if (e.code === "MCP_UNAVAILABLE") return frDesign.connect.figma.unreachable.title;
  return failureText(e);
}
