export function expandHome(text: string, home: string): string {
  const path = text.trim();
  if (path === "~") return home;
  return path.startsWith("~/") ? `${home}${path.slice(1)}` : path;
}
