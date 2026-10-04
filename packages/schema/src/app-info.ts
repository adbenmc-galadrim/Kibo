import { z } from "zod";
import type { Environment } from "./ai";

export const AppPlatform = z.enum(["darwin", "linux"]);
export type AppPlatform = z.infer<typeof AppPlatform>;
export const AppArch = z.enum(["arm64", "x64"]);
export type AppArch = z.infer<typeof AppArch>;

export const AppInfo = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  platform: AppPlatform,
  arch: AppArch,
  home: z.string().min(1),
  daemonPid: z.number().int().positive(),
  uptimeMs: z.number().int().nonnegative(),
});
export type AppInfo = z.infer<typeof AppInfo>;

export type Diagnostics = {
  app: AppInfo;
  environment: Environment;
  counts: { projects: number; tickets: number; components: number; instances: number; profiles: number };
  integrations: { id: string; state: string }[];
  log: string[];
};
