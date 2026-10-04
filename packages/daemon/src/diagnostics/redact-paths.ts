export function redactPaths(text: string, userHome: string): string {
  const home = userHome.replace(/\/+$/, "");
  return home.length === 0 ? text : text.split(home).join("~");
}
