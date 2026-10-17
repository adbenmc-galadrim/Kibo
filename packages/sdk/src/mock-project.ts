import { sprintsApi } from "./sprints-api";
import type { KiboSdk } from "./types";

type Recorder = <T>(permission: string, label: string, work: () => Promise<T>) => Promise<T>;
type TrackingApis = Pick<KiboSdk, "project" | "sprints">;

export function recordedTrackingApis(
  inner: TrackingApis,
  record: Recorder,
  outer: () => Pick<KiboSdk, "list" | "run">,
): TrackingApis {
  return {
    project: {
      get: () => record("read:ticket", "read project", () => inner.project.get()),
      subscribe: inner.project.subscribe,
    },
    sprints: sprintsApi({
      list: (type) => outer().list(type),
      run: (cmd) => outer().run(cmd),
      open: inner.sprints.open,
    }),
  };
}
