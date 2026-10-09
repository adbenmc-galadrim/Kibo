import { KiboError } from "@kibo/schema";
import type { ProjectAgentDataPort, ProjectAgentOps } from "./types";

const unavailable = (): never => {
  throw new KiboError("INTERNAL", "the project agent is not available yet");
};

export const unwiredProjectAgentData: ProjectAgentDataPort = {
  project: unavailable,
  projectName: unavailable,
  projectFolder: unavailable,
  assertWritable: unavailable,
  viewer: unavailable,
  profiles: unavailable,
  guidelines: unavailable,
  isDemoProject: unavailable,
  notes: async () => unavailable(),
  readNote: async () => unavailable(),
  writeNote: async () => unavailable(),
  runCommand: unavailable,
};

export const unwiredProjectAgentOps: ProjectAgentOps = {
  tool: async () => unavailable(),
  apply: async () => unavailable(),
};
