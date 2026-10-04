import { lazyPanel } from "@kibo/sdk";
import { AboutDialog } from "../about/AboutDialog";
import { fr } from "../i18n/fr";
import { useRpcQuery } from "../state/use-rpc-query";
import { BundledWhatsNewDialog } from "../whats-new/BundledWhatsNewDialog";
import { markWhatsNewSeen } from "../whats-new/whats-new";
import { helpPatch } from "./help-dialogs";
import type { DialogsState } from "./ShellDialogs";
import { useOpened } from "./use-opened";

type Props = { state: DialogsState; set(patch: Partial<DialogsState>): void };

const hidden = { fallback: "sr-only" } as const;
const ShortcutsDialog = lazyPanel(
  () => import("../help/ShortcutsDialog").then((m) => m.ShortcutsDialog),
  fr.lazy,
  hidden,
);
const ReportDialog = lazyPanel(
  () => import("../report/ReportDialog").then((m) => m.ReportDialog),
  fr.lazy,
  hidden,
);

const APP_INFO = { method: "getAppInfo" } as const;
const NO_REFRESH = [] as const;
const daemonPort = (): number | null => Number(location.port) || null;

export function HelpDialogs({ state, set }: Props) {
  const { data: info } = useRpcQuery(APP_INFO, NO_REFRESH);
  const aboutOpened = useOpened(state.about);
  const whatsNewOpened = useOpened(state.whatsNew);
  const shortcutsOpened = useOpened(state.shortcutsHelp);
  const reportOpened = useOpened(state.report);
  return (
    <>
      {aboutOpened && (
        <AboutDialog
          open={state.about}
          info={info}
          port={daemonPort()}
          onClose={() => set({ about: false })}
          onReleaseNotes={() => set(helpPatch("whatsNew"))}
        />
      )}
      {whatsNewOpened && info && (
        <BundledWhatsNewDialog
          open={state.whatsNew}
          version={info.version}
          onSeen={(version) => {
            markWhatsNewSeen(version);
            set({ whatsNew: false });
          }}
        />
      )}
      {shortcutsOpened && (
        <ShortcutsDialog open={state.shortcutsHelp} onClose={() => set({ shortcutsHelp: false })} />
      )}
      {reportOpened && <ReportDialog open={state.report} onClose={() => set({ report: false })} />}
    </>
  );
}
