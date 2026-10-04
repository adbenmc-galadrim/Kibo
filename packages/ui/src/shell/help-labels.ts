import { fr } from "../i18n/fr";
import type { HelpDialog } from "./help-dialogs";

export const helpLabel = (key: HelpDialog): string =>
  ({
    shortcutsHelp: fr.header.helpShortcuts,
    tutorial: fr.header.helpTutorial,
    whatsNew: fr.header.helpWhatsNew,
    report: fr.header.helpReport,
    about: fr.header.helpAbout,
  })[key];
