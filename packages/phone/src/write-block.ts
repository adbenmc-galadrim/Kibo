import type { WritesApi } from "@kibo/sdk";
import { frWrites } from "./i18n/fr-writes";
import type { Connectivity, RemoteClient } from "./remote-client";

export function writeBlockOf({ macOnline, phoneOnline }: Connectivity): string | null {
  if (!phoneOnline) return frWrites.phoneOffline;
  return macOnline ? null : frWrites.macOff;
}

export const canWrite = (connectivity: Connectivity): boolean => writeBlockOf(connectivity) === null;

export function presenceWrites(client: Pick<RemoteClient, "presence" | "onPresence">): WritesApi {
  return {
    blocked: () => writeBlockOf(client.presence()),
    subscribe: (listener) => client.onPresence(() => listener()),
  };
}
