import {
  type DuplicationSettings,
  openLimitOf,
  type ProjectDelivery,
  type ProjectPatch,
  type ProjectSummary,
  STORYBOOK_DEFAULTS,
  type StorybookSettings,
  type TrackingSettings,
  WORKTREE_DEFAULTS,
  type WorktreeSettings,
} from "@kibo/schema";
import { sameDuplication } from "../overlaps/DuplicationFields";
import { sameDelivery } from "./delivery-draft";

export type Fields = {
  name: string;
  color: string;
  folder: string;
  worktree?: WorktreeSettings | null;
  storybook?: StorybookSettings | null;
  duplication?: DuplicationSettings | null;
  delivery?: ProjectDelivery | null;
  tracking?: TrackingSettings | null;
};

const sameWorktree = (a: WorktreeSettings | null, b: WorktreeSettings | null) =>
  JSON.stringify(a ?? WORKTREE_DEFAULTS) === JSON.stringify(b ?? WORKTREE_DEFAULTS);
const sameStorybook = (a: StorybookSettings | null, b: StorybookSettings | null) =>
  JSON.stringify(a ?? STORYBOOK_DEFAULTS) === JSON.stringify(b ?? STORYBOOK_DEFAULTS);

export function projectPatch(project: ProjectSummary, fields: Fields): ProjectPatch | null {
  const patch: ProjectPatch = {};
  const name = fields.name.trim();
  if (name !== project.name) patch.name = name;
  if (fields.color !== project.color) patch.color = fields.color;
  const folder = fields.folder.trim() || null;
  if (folder !== project.folder) patch.folder = folder;
  const worktree = fields.worktree;
  if (worktree !== undefined && !sameWorktree(worktree, project.worktree)) patch.worktree = worktree;
  const storybook = fields.storybook;
  if (storybook !== undefined && !sameStorybook(storybook, project.storybook)) patch.storybook = storybook;
  const duplication = fields.duplication;
  if (duplication !== undefined && !sameDuplication(duplication, project.duplication))
    patch.duplication = sameDuplication(duplication, null) ? null : duplication;
  const delivery = fields.delivery;
  if (delivery !== undefined && !sameDelivery(delivery, project.delivery)) patch.delivery = delivery;
  const tracking = fields.tracking;
  if (tracking !== undefined && openLimitOf(tracking) !== openLimitOf(project.tracking))
    patch.tracking = tracking;
  return Object.keys(patch).length === 0 ? null : patch;
}
