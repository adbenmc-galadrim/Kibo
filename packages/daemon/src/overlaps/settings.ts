import { effectiveDuplication } from "@kibo/core";
import type { DuplicationSettings } from "@kibo/schema";
import type { ProjectSettings } from "../notes/settings";
import { localDuplication } from "../project-folder";

export const duplicationSettings =
  (settings: Pick<ProjectSettings, "get">) =>
  (projectId: string): DuplicationSettings =>
    effectiveDuplication({ duplication: localDuplication(settings, projectId) });
