const pad = (n: number): string => String(n).padStart(2, "0");

export function clockTime(at: number): string {
  const d = new Date(at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
