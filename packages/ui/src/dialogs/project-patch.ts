import {
  openLimitOf,
  type ProjectPatch,
  type ProjectSummary,
  STORYBOOK_DEFAULTS,
  type StorybookSettings,
  type TrackingSettings,
} from "@kibo/schema";

type Fields = {
  name: string;
  color: string;
  folder: string;
  description?: string;
  storybook?: StorybookSettings | null;
  tracking?: TrackingSettings | null;
};

const sameStorybook = (a: StorybookSettings | null, b: StorybookSettings | null) =>
  JSON.stringify(a ?? STORYBOOK_DEFAULTS) === JSON.stringify(b ?? STORYBOOK_DEFAULTS);

export function projectPatch(project: ProjectSummary, fields: Fields): ProjectPatch | null {
  const patch: ProjectPatch = {};
  const name = fields.name.trim();
  if (name !== project.name) patch.name = name;
  if (fields.color !== project.color) patch.color = fields.color;
  const description = fields.description === undefined ? undefined : fields.description.trim() || null;
  if (description !== undefined && description !== project.description) patch.description = description;
  const folder = fields.folder.trim() || null;
  if (folder !== project.folder) patch.folder = folder;
  const storybook = fields.storybook;
  if (storybook !== undefined && !sameStorybook(storybook, project.storybook)) patch.storybook = storybook;
  const tracking = fields.tracking;
  if (tracking !== undefined && openLimitOf(tracking) !== openLimitOf(project.tracking))
    patch.tracking = tracking;
  return Object.keys(patch).length === 0 ? null : patch;
}
