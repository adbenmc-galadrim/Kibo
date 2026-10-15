import type { AppInfo } from "@kibo/schema";

export const appInfoFixture = (userHome: string | null): AppInfo => ({
  version: "0.24.0-alpha.1",
  platform: "darwin",
  arch: "arm64",
  home: "~/.kibo",
  userHome,
  daemonPid: 42,
  uptimeMs: 0,
});
