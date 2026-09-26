import { fr } from "./fr";

const dayStart = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export function noteDate(mtime: number, now: number = Date.now()): string {
  const days = Math.round((dayStart(now) - dayStart(mtime)) / 86_400_000);
  if (days <= 0) return fr.today;
  if (days === 1) return fr.yesterday;
  const d = new Date(mtime);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
