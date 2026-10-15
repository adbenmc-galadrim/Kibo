import { ALLOW_MAX, type DeliveryPublication, isSafeAllowRule } from "@kibo/schema";

export type DeliveryProfile = {
  allow: string[];
  publication: DeliveryPublication | null;
  rejected: string[];
};

const AUTHORISATIONS = "autorisations";
const PUBLICATION = "publication";

function sectionOf(text: string, title: string): string[] | null {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s/.test(line) && line.slice(2).trim().toLowerCase() === title);
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{1,2}\s/.test(line));
  return end < 0 ? rest : rest.slice(0, end);
}

const quotedRule = (line: string): string | null => {
  const match = /^\s*[-*]\s+`([^`]+)`/.exec(line);
  return match?.[1]?.trim() ?? null;
};

function readAllow(section: string[] | null): Pick<DeliveryProfile, "allow" | "rejected"> {
  const allow: string[] = [];
  const rejected: string[] = [];
  for (const rule of section?.flatMap((line) => quotedRule(line) ?? []) ?? []) {
    if (allow.includes(rule) || rejected.includes(rule)) continue;
    if (isSafeAllowRule(rule) && allow.length < ALLOW_MAX) allow.push(rule);
    else rejected.push(rule);
  }
  return { allow, rejected };
}

function readPublication(section: string[] | null): DeliveryPublication | null {
  const first = section?.map((line) => line.trim()).find((line) => line.length > 0);
  const word = first && /^`?(draft|local)\b`?/.exec(first)?.[1];
  return word === "draft" || word === "local" ? word : null;
}

export function parseDeliveryProfile(text: string): DeliveryProfile {
  return {
    ...readAllow(sectionOf(text, AUTHORISATIONS)),
    publication: readPublication(sectionOf(text, PUBLICATION)),
  };
}
