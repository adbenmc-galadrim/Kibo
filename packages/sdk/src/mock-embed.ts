import { capPermission } from "@kibo/schema";
import type { KiboSdk } from "./types";

type Recorder = <T>(permission: string, label: string, work: () => Promise<T>) => Promise<T>;
type FrameApis = Pick<KiboSdk, "design">;

export function recordedFrameApis(inner: FrameApis, record: Recorder): FrameApis {
  const design = capPermission("design");
  return {
    design: {
      frame: (url, opts) => record(design, design, () => inner.design.frame(url, opts)),
      storybooks: () => record(design, design, () => inner.design.storybooks()),
    },
  };
}
