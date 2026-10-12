import { expect, test } from "bun:test";
import { createWorkspaceDoc } from "@kibo/core/workspace";
import { KiboError, RpcRequest } from "@kibo/schema";
import type { Docs } from "./docs";
import { runConfigCommand } from "./workspace-config";

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
    activity: unused,
  };
}

test("the profile commands are refused before reaching the workspace", () => {
  for (const method of ["createProfile", "updateProfile", "deleteProfile"]) {
    const req = { method: "config", command: { method, profileId: "assistant", profile: {}, patch: {} } };
    expect(RpcRequest.safeParse(req).success).toBe(false);
  }
});

test("a workspace command still runs", () => {
  const docs = docsWith();
  const result = runConfigCommand(docs, { method: "updateWorkspace", patch: { name: "Maison" } });
  expect(result).toEqual({ name: "Maison", description: null });
});
