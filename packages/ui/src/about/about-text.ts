import type { AppInfo } from "@kibo/schema";
import { frAbout as t } from "../i18n/fr-about";

export type AboutInfo = AppInfo & { shell: "tauri" | "browser" };

export function uptimeLabel(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return t.lessThanMinute;
  if (minutes < 60) return t.minutes(minutes);
  return t.hours(Math.floor(minutes / 60), minutes % 60);
}

export const systemLine = (info: AboutInfo): string =>
  [t.platform[info.platform], t.arch[info.platform][info.arch], t.shell[info.shell]].join(" · ");

export function aboutText(info: AboutInfo, port: number | null): string {
  return [
    t.version(info.version),
    systemLine(info),
    t.daemon(info.daemonPid, port, info.home),
    t.uptime(uptimeLabel(info.uptimeMs)),
  ].join("\n");
}
