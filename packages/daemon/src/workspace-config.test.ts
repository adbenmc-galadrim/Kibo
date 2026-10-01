import { expect, test } from "bun:test";
import { createWorkspaceDoc } from "@kibo/core/workspace";
import { KiboError } from "@kibo/schema";
import type { Docs } from "./docs";
import { ensureSystemProfiles, runConfigCommand } from "./workspace-config";

function docsWith(): Docs {
  const unused = () => {
    throw new KiboError("INTERNAL", "not used");
  };
  return {
    workspace: createWorkspaceDoc(),
    project: unused,
    projectIds: () => [],
    save: () => {},
    emit: () => {},
    run: unused,
    trigger: unused,
    replaceProject: unused,
    addProject: unused,
    removeProject: unused,
    onProjectRemoved: unused,
    imported: unused,
    onProjectDoc: unused,
    assertWritable: unused,
    setWriteGuard: unused,
    projectMeta: unused,
    updateProjectMeta: unused,
    identity: unused,
    setIdentity: unused,
  };
}

test("deleting a system profile with active runs is refused as invalid, not in use", () => {
  const docs = docsWith();
  ensureSystemProfiles(docs);
  const del = () => runConfigCommand(docs, { method: "deleteProfile", profileId: "assistant" }, () => 1);
  expect(del).toThrow("INVALID_INPUT");
});
