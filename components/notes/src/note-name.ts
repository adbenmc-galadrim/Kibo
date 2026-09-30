const MAX_SLUG = 40;
const UNTITLED = /^sans-titre(-\d+)?\.md$/;

export function slugify(title: string): string {
  const s = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length < 2) return "";
  return s.slice(0, MAX_SLUG).replace(/-+$/, "");
}

const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const folderOf = (path: string) => path.slice(0, path.lastIndexOf("/") + 1);

export const isUntitledPath = (path: string): boolean => UNTITLED.test(fileName(path));

export function renamedPath(from: string, title: string): string | null {
  const slug = slugify(title);
  return slug ? `${folderOf(from)}${slug}.md` : null;
}

export const createdPath = (title: string): string | null => renamedPath("", title);

export function autoRenameTarget(
  note: { path: string; title: string },
  taken: readonly string[],
): string | null {
  if (!isUntitledPath(note.path)) return null;
  const target = renamedPath(note.path, note.title);
  if (target === null || target === note.path || isUntitledPath(target) || taken.includes(target))
    return null;
  return target;
}
