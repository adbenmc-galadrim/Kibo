import type { FoldContext, FoldedMoment } from "@kibo/core";
import {
  actionsFailed,
  type HookPayload,
  MOMENT_ACTIONS_MAX,
  MOMENT_MESSAGE_MAX,
  maskSecretsWithin,
  type RunAction,
  summarizeActions,
} from "@kibo/schema";
import { actionFromHook } from "./hook-actions";

const SUMMARY_MAX = 300;

export class HookGroup {
  private actions: RunAction[] = [];
  private at: number | null = null;

  push(action: RunAction, ctx: FoldContext): FoldedMoment[] {
    const flushed = this.actions.length >= MOMENT_ACTIONS_MAX ? this.flush(ctx) : [];
    if (this.actions.length === 0) this.at = ctx.now;
    this.actions.push(action);
    return flushed;
  }

  flush(ctx: FoldContext): FoldedMoment[] {
    if (this.actions.length === 0) return [];
    const actions = this.actions;
    const summary = maskSecretsWithin(summarizeActions(actions), SUMMARY_MAX);
    const at = this.at ?? ctx.now;
    this.actions = [];
    this.at = null;
    return [
      { data: { kind: "actions", actions, summary, failed: actionsFailed(actions) }, at, stepId: ctx.stepId },
    ];
  }
}

export function hookMoments(group: HookGroup, payload: HookPayload, ctx: FoldContext): FoldedMoment[] {
  const action = actionFromHook(payload);
  if (action) return group.push(action, ctx);
  if (payload.event !== "Stop") return [];
  const flushed = group.flush(ctx);
  if (payload.detail === null || payload.detail.trim() === "") return flushed;
  const text = maskSecretsWithin(payload.detail, MOMENT_MESSAGE_MAX);
  return [...flushed, { data: { kind: "message", text }, at: ctx.now, stepId: ctx.stepId }];
}
