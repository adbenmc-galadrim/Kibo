import { z } from "zod";

export const NetRule = z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}(\/[A-Za-z0-9._~/-]*)?$/);
export type NetRule = z.infer<typeof NetRule>;

export function ruleCovers(rule: string, url: string): boolean {
  if (!URL.canParse(url)) return false;
  const u = new URL(url);
  if (u.protocol !== "https:" || u.port !== "" || u.username !== "" || u.password !== "") return false;
  const slash = rule.indexOf("/");
  const host = slash < 0 ? rule : rule.slice(0, slash);
  const prefix = slash < 0 ? "" : rule.slice(slash);
  if (u.hostname !== host) return false;
  if (prefix === "" || prefix === "/") return true;
  const base = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return u.pathname === base || u.pathname.startsWith(`${base}/`);
}
