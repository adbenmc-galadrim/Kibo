import { useCallback, useEffect, useRef, useState } from "react";
import { useProject } from "../state/use-projects";

export function useProjectFocus(activeProjectId: string | null) {
  const [lastProjectId, setLastProjectId] = useState<string | null>(activeProjectId);
  const ticketProject = useProject(activeProjectId ?? lastProjectId);
  const project = activeProjectId ? ticketProject : null;
  const projectRef = useRef(project);
  useEffect(() => {
    if (activeProjectId) setLastProjectId(activeProjectId);
  }, [activeProjectId]);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  const forget = useCallback(
    (projectId: string) => setLastProjectId((id) => (id === projectId ? null : id)),
    [],
  );
  const currentProject = useCallback(() => projectRef.current, []);
  return { lastProjectId, ticketProject, project, projectRef, currentProject, forget };
}
