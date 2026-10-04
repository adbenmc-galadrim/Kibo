import type { AppInfo } from "@kibo/schema";
import { client } from "../api";
import { listenAboutEvent } from "../desktop/about-event";
import { applyWhatsNew } from "../whats-new/whats-new";
import type { HelpDialog } from "./help-dialogs";

type HelpBootDeps = { listenAbout(onAbout: () => void): void; appInfo(): Promise<AppInfo> };

export function createHelpBoot(deps: HelpBootDeps): (open: (key: HelpDialog) => void) => void {
  let current: (key: HelpDialog) => void = () => {};
  let started = false;
  return (open) => {
    current = open;
    if (started) return;
    started = true;
    deps.listenAbout(() => current("about"));
    deps
      .appInfo()
      .then((info) => applyWhatsNew(info.version, () => current("whatsNew")))
      .catch((e: unknown) => console.error("what's new check failed", e));
  };
}

export const startHelp = createHelpBoot({
  listenAbout: listenAboutEvent,
  appInfo: () => client.rpc({ method: "getAppInfo" }),
});
