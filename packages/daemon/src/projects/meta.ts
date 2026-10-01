import { setProjectMeta, updateRegisteredProject } from "@kibo/core";
import type { ProjectMeta, ProjectPatch } from "@kibo/schema";
import type { Docs } from "../docs";

const docFields = (patch: ProjectPatch): ProjectPatch => ({
  ...(patch.name !== undefined && { name: patch.name }),
  ...(patch.color !== undefined && { color: patch.color }),
});

export function writeProjectMeta(
  docs: Docs,
  projectId: string,
  patch: ProjectPatch,
  folderInDoc: boolean,
): ProjectMeta {
  const doc = docs.project(projectId);
  const docPatch = folderInDoc ? patch : docFields(patch);
  if (Object.keys(docPatch).length > 0) setProjectMeta(doc, docPatch);
  updateRegisteredProject(docs.workspace, projectId, patch);
  docs.save(projectId);
  docs.save(null);
  docs.emit({ projectId });
  docs.emit({ projectId: null });
  return docs.projectMeta(projectId);
}
