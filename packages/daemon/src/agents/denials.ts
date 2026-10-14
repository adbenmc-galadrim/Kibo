import {
  type DenialContext,
  type DenialItem,
  type DeniedAction,
  isClaudeDenial,
  proposeRules,
  type RunAction,
} from "@kibo/schema";

export type TurnDenialContext = DenialContext & {
  allowed: readonly string[];
  addDirs: readonly string[];
};

const within = (path: string, dir: string): boolean =>
  path === dir || path.startsWith(`${dir.replace(/\/+$/, "")}/`);

export function refusedActions(actions: readonly RunAction[], denied: readonly string[]): RunAction[] {
  return actions.filter(
    (a) => isClaudeDenial(a.detail) && (a.outcome === "denied" || denied.includes(a.tool)),
  );
}

const deniedAction = (a: RunAction): DeniedAction => ({ tool: a.tool, target: a.command ?? a.target });

function alreadyAllowed(item: DenialItem, ctx: TurnDenialContext): boolean {
  if (item.rule !== null) return ctx.allowed.includes(item.rule);
  const dir = item.addDir;
  return dir !== null && ctx.addDirs.some((known) => within(dir, known));
}

export function denialsOfTurn(
  actions: readonly RunAction[],
  denied: readonly string[],
  ctx: TurnDenialContext,
): DenialItem[] {
  const refused = refusedActions(actions, denied).map(deniedAction);
  if (refused.length === 0) return [];
  return proposeRules(refused, ctx).filter((item) => !alreadyAllowed(item, ctx));
}
