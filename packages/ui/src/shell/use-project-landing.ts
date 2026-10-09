import type { ProjectSnapshot } from "@kibo/schema";
import { useEffect } from "react";
import { replaceRoute } from "../route";
import { landingTarget } from "../tabs/project-landing";
import { activeTarget } from "../tabs/tabs-model";
import type { TabsApi } from "../tabs/use-tabs";

export function useProjectLanding(tabs: TabsApi, project: ProjectSnapshot | null): void {
  const { state, dispatch } = tabs;
  const active = activeTarget(state);
  const loaded = project && active?.kind === "project" && project.meta.id === active.projectId;
  const landing = loaded ? landingTarget(active, project.pages) : null;
  const tabId = state.activeId;
  const projectId = landing?.kind === "page" ? landing.projectId : null;
  const pageId = landing?.kind === "page" ? landing.pageId : null;
  useEffect(() => {
    if (!tabId || !projectId || !pageId) return;
    const target = { kind: "page", projectId, pageId } as const;
    replaceRoute(target);
    dispatch({ type: "retarget", id: tabId, target });
  }, [tabId, projectId, pageId, dispatch]);
}
