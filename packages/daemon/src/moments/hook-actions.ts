import {
  actionLabel,
  actionOf,
  type HookPayload,
  maskSecrets,
  maskSecretsWithin,
  type RunAction,
  SKILL_REVIEW_TOOL,
  SKILL_REVIEWS_PER_CALL_MAX,
} from "@kibo/schema";

const TARGET_MAX = 500;
const LABEL_MAX = 200;
const INPUT_KEYS = ["file_path", "notebook_path", "pattern", "command", "skill"] as const;
const CALL_ID_MAX = 64;

const REVIEWED = /^(\d+) skills?$/;

function reviewInput(detail: string | null): Record<string, unknown> {
  const count = Number(REVIEWED.exec(detail ?? "")?.[1] ?? Number.NaN);
  if (!Number.isInteger(count)) return {};
  return { reviews: Array.from({ length: Math.min(count, SKILL_REVIEWS_PER_CALL_MAX) }, () => ({})) };
}

const inputOf = (tool: string, detail: string | null): Record<string, unknown> => {
  if (tool === SKILL_REVIEW_TOOL) return reviewInput(detail);
  return detail === null ? {} : Object.fromEntries(INPUT_KEYS.map((key) => [key, detail]));
};

export function actionFromHook(payload: HookPayload): RunAction | null {
  if (payload.event !== "PostToolUse" || payload.tool === null) return null;
  const detail = payload.detail === null ? null : maskSecrets(payload.detail);
  const action = actionOf({
    tool: payload.tool,
    input: inputOf(payload.tool, detail),
    output: null,
    isError: false,
    denied: false,
    patch: null,
  });
  const target = action.target === null ? null : maskSecretsWithin(action.target, TARGET_MAX);
  const base = { ...action, target };
  const callId = payload.toolUseId;
  return {
    ...base,
    label: maskSecretsWithin(actionLabel(base, inputOf(payload.tool, detail)), LABEL_MAX),
    ...(callId !== null && callId.length <= CALL_ID_MAX ? { callId } : {}),
  };
}
