import { usePref } from "../lib/local-pref";
import { PROJECT_ALL } from "./project-filter";

export const AGENTS_PROJECT_KEY = "kibo.agents.project";

export const useAgentsProject = (): [string, (value: string) => void] =>
  usePref(AGENTS_PROJECT_KEY, PROJECT_ALL);
