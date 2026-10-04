export function backupIdAt(now: number): string {
  return `${new Date(now).toISOString().slice(0, 19).replaceAll(":", "-")}Z`;
}

export function backupTime(id: string): number {
  const [date = "", time = ""] = id.slice(0, -1).split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes, seconds] = time.split("-").map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0, seconds ?? 0);
}
