import { INBOX_ID, type ProjectMeta } from "@kibo/schema";
import { useMemo } from "react";
import { useSnapshots } from "../state/use-snapshots";

export function useWorkspaceSnapshots(projects: readonly ProjectMeta[]) {
  const ids = useMemo(() => [...projects.map((p) => p.id), INBOX_ID], [projects]);
  return useSnapshots(ids);
}
