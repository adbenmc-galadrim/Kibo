export function splitPath(path: string): { dir: string; name: string } {
  const slash = path.lastIndexOf("/");
  return { dir: slash >= 0 ? path.slice(0, slash + 1) : "", name: path.slice(slash + 1) };
}

export function columnOf(text: string | null, line: number | null): number {
  if (!text || line === null) return 1;
  const index = (text.split("\n")[line - 1] ?? "").search(/\S/);
  return index < 0 ? 1 : index + 1;
}
