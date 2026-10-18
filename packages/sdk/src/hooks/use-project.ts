import type { ProjectInfo } from "@kibo/schema";
import { useSdk } from "../react";
import { type Read, useSdkValue, type Watch } from "../sdk-value";

const readProject: Read<ProjectInfo | null> = (sdk) => sdk.project.get();
const watchProject: Watch = (sdk, l) => sdk.project.subscribe(l);

export function useProject(): ProjectInfo | null {
  return useSdkValue<ProjectInfo | null>(useSdk(), readProject, watchProject, null);
}
