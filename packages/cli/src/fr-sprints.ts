import { DAEMON_HELP, usageText } from "./fr-usage";

export const SPRINTS_USAGE = [
  "  kibo sprints list --project <clé|nom|id> [--json]",
  "  kibo sprints create <code> [--name <nom>] --start AAAA-MM-JJ --end AAAA-MM-JJ --project <p> [--json]",
  "  kibo sprints update <code> [--code <c>] [--name <n>] [--start <d>] [--end <d>] --project <p> [--json]",
  "  kibo sprints assign <F> <S|--none> --project <p> [--json]",
];

export const frSprints = {
  usage: usageText(SPRINTS_USAGE, DAEMON_HELP),
};
