import type { OverlapDetail } from "@kibo/schema";

const code = (text: string): string => `\`${text}\``;

export function overlapLabel(detail: OverlapDetail): string {
  if (detail.kind === "export") return code(detail.name);
  if (detail.kind === "file") return code(detail.path);
  return `bloc de ${detail.lines} lignes (${code(detail.ownerPath)})`;
}
