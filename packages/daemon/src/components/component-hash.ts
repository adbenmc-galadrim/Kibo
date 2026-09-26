import { getRegistryVersion } from "@kibo/core";
import { isBuiltinId, type ProjectCommand, splitRef } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import type { CommandInterceptor } from "../docs";

export function approvedHashOf(workspace: LoroDoc, ref: string): string | null {
  const { id, version } = splitRef(ref);
  if (isBuiltinId(id)) return null;
  return getRegistryVersion(workspace, id, version)?.approvedHash ?? null;
}

export function stampComponentHash(workspace: LoroDoc): CommandInterceptor {
  return (_projectId, cmd): ProjectCommand => {
    if (cmd.method !== "addInstance" && cmd.method !== "setInstanceComponent") return cmd;
    return { ...cmd, componentHash: approvedHashOf(workspace, cmd.component) };
  };
}
