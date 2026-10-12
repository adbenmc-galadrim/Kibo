import {
  type AgentFile,
  type AgentRef,
  type AgentSettingsPatch,
  agentNameProblem,
  descriptionProblem,
  isReservedAgentName,
  KiboError,
  parseAgentRef,
  SYSTEM_MAX_PARALLEL,
  suggestAgentName,
} from "@kibo/schema";
import { agentFileName } from "./paths";

const SYSTEM_PATCHABLE = new Set(["enabled", "maxParallel"]);

export function assertNewName(name: string, description: string): void {
  if (isReservedAgentName(name)) throw new KiboError("CONFLICT", `${name} is reserved to Kibo`);
  const problem = agentNameProblem(name);
  if (problem === null) return;
  const suggestion = suggestAgentName(description);
  throw new KiboError(
    "INVALID_INPUT",
    suggestion === "" ? problem : `${problem} — suggestion : ${suggestion}`,
  );
}

export function assertDescription(description: string): void {
  const problem = descriptionProblem(description);
  if (problem !== null) throw new KiboError("INVALID_INPUT", problem);
}

export function assertFileMatchesRef(ref: AgentRef, file: AgentFile): void {
  if (file.frontmatter.name !== agentFileName(ref)) {
    throw new KiboError("INVALID_INPUT", `the name field must stay ${agentFileName(ref)}`);
  }
}

export function assertNotSystem(ref: AgentRef, action: string): void {
  if (parseAgentRef(ref).scope === "system")
    throw new KiboError("FORBIDDEN", `a Kibo agent cannot be ${action}`);
}

function assertSubagents(owner: AgentRef, subagents: readonly AgentRef[]): void {
  const parsedOwner = parseAgentRef(owner);
  for (const sub of subagents) {
    const parsed = parseAgentRef(sub);
    if (sub === owner) throw new KiboError("INVALID_INPUT", "an agent cannot call itself");
    if (parsed.scope === "system") throw new KiboError("INVALID_INPUT", `${sub} cannot be a subagent`);
    if (
      parsed.scope === "project" &&
      (parsedOwner.scope !== "project" || parsedOwner.projectId !== parsed.projectId)
    ) {
      throw new KiboError("INVALID_INPUT", `${sub} belongs to another project`);
    }
  }
}

function assertSystemPatch(ref: AgentRef, patch: AgentSettingsPatch): void {
  const parsed = parseAgentRef(ref);
  if (parsed.scope !== "system") return;
  const refused = Object.keys(patch).filter((key) => !SYSTEM_PATCHABLE.has(key));
  if (refused.length > 0) {
    throw new KiboError(
      "INVALID_INPUT",
      `a Kibo agent only changes enabled and maxParallel, not ${refused.join(", ")}`,
    );
  }
  if (patch.maxParallel === undefined) return;
  if (patch.maxParallel > SYSTEM_MAX_PARALLEL) {
    throw new KiboError("INVALID_INPUT", `a Kibo agent runs at most ${SYSTEM_MAX_PARALLEL} at once`);
  }
  if (parsed.id === "demo" && patch.maxParallel !== 1) {
    throw new KiboError("INVALID_INPUT", "the demo agent runs one ticket at a time");
  }
}

export function assertSettingsPatch(ref: AgentRef, patch: AgentSettingsPatch): void {
  assertSystemPatch(ref, patch);
  if (patch.subagents) assertSubagents(ref, patch.subagents);
}
