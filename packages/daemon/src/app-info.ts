import { AppArch, type AppInfo, AppPlatform, KiboError } from "@kibo/schema";

export function abbreviateHomePath(path: string, userHome: string): string {
  if (path === userHome) return "~";
  return path.startsWith(`${userHome}/`) ? `~${path.slice(userHome.length)}` : path;
}

type AppInfoDeps = {
  version: string;
  home: string;
  userHome: string;
  pid: number;
  startedAt: number;
  now(): number;
  platform: string;
  arch: string;
};

export function createAppInfo(deps: AppInfoDeps): () => AppInfo {
  const platform = AppPlatform.safeParse(deps.platform);
  if (!platform.success) throw new KiboError("INTERNAL", `unsupported platform ${deps.platform}`);
  const arch = AppArch.safeParse(deps.arch);
  if (!arch.success) throw new KiboError("INTERNAL", `unsupported architecture ${deps.arch}`);
  const home = abbreviateHomePath(deps.home, deps.userHome);
  return () => ({
    version: deps.version,
    platform: platform.data,
    arch: arch.data,
    home,
    daemonPid: deps.pid,
    uptimeMs: Math.max(0, deps.now() - deps.startedAt),
  });
}
