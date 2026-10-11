import {
  actionLabel,
  actionOf,
  type HookPayload,
  maskSecrets,
  maskSecretsWithin,
  type RunAction,
} from "@kibo/schema";

const TARGET_MAX = 500;
const LABEL_MAX = 200;
const INPUT_KEYS = ["file_path", "notebook_path", "pattern", "command"] as const;

const inputOf = (detail: string | null): Record<string, unknown> =>
  detail === null ? {} : Object.fromEntries(INPUT_KEYS.map((key) => [key, detail]));

export function actionFromHook(payload: HookPayload): RunAction | null {
  if (payload.event !== "PostToolUse" || payload.tool === null) return null;
  const detail = payload.detail === null ? null : maskSecrets(payload.detail);
  const action = actionOf({
    tool: payload.tool,
    input: inputOf(detail),
    output: null,
    isError: false,
    denied: false,
    patch: null,
  });
  const target = action.target === null ? null : maskSecretsWithin(action.target, TARGET_MAX);
  const base = { ...action, target };
  return { ...base, label: maskSecretsWithin(actionLabel(base), LABEL_MAX) };
}
