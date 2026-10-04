export const HELP_DIALOGS = ["shortcutsHelp", "tutorial", "whatsNew", "report", "about"] as const;
export type HelpDialog = (typeof HELP_DIALOGS)[number];

export const isHelpDialog = (kind: string): kind is HelpDialog => HELP_DIALOGS.some((k) => k === kind);

export const helpPatch = (key: HelpDialog): Record<HelpDialog, boolean> => ({
  shortcutsHelp: false,
  tutorial: false,
  whatsNew: false,
  report: false,
  about: false,
  [key]: true,
});
