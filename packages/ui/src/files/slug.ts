import { ProjectAssetName } from "@kibo/schema";

const MAX_BASE = 100;

export function slugName(original: string): string | null {
  const dot = original.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = original.slice(dot + 1).toLowerCase();
  const base = original
    .slice(0, dot)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, MAX_BASE)
    .replace(/[^a-z0-9]+$/, "");
  const name = `${base || "fichier"}.${ext}`;
  return ProjectAssetName.safeParse(name).success ? name : null;
}
