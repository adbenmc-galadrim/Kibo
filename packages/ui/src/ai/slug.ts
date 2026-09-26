const MAX_ID = 40;

export function suggestTitle(description: string): string {
  const words = description
    .trim()
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
    .slice(0, 3)
    .join(" ");
  const title = words.slice(0, 40);
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function slugify(title: string): string {
  const s = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length < 2) return "";
  const id = /^[a-z]/.test(s) ? s : `c-${s}`;
  return id.slice(0, MAX_ID).replace(/-+$/, "");
}
