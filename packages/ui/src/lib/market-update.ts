import {
  addedPermissions,
  type ComponentVersionSummary,
  grantedOf,
  type MarketPackageDetail,
  type PublishPreview,
} from "@kibo/schema";

export type UpdateSummary = Pick<
  PublishPreview,
  "from" | "to" | "usages" | "changes" | "newPermissions" | "migration"
>;

const MANIFEST_FILE = "kibo.component.json";
const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

function parsedJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

function changesOf(files: { path: string; content: string }[]): string[] {
  const manifest = files.find((f) => f.path === MANIFEST_FILE);
  if (!manifest) return [];
  const json = parsedJson(manifest.content);
  const changes = typeof json === "object" && json !== null && "changes" in json ? json.changes : [];
  return isStringList(changes) ? changes : [];
}

export function buildUpdateSummary(input: {
  summary: ComponentVersionSummary;
  detail: Pick<MarketPackageDetail, "version" | "permissions" | "files">;
}): UpdateSummary {
  const { summary, detail } = input;
  return {
    from: summary.version,
    to: detail.version,
    usages: summary.usages.map((u) => ({ ...u, version: summary.version })),
    changes: changesOf(detail.files),
    newPermissions: addedPermissions(
      summary.manifest ? grantedOf(summary.manifest) : null,
      detail.permissions,
    ),
    migration: null,
  };
}
