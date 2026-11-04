import { contrast, ensureContrast, mix } from "./color-math";
import type { Role, Roles } from "./palette-roles";

export type PaletteIssue = { role: Role; on: Role | "soft"; ratio: number; min: number };

const TEXT_ROLES = ["fg", "mfg", "dim", "blue", "purple", "green", "red", "amber", "hold"] as const;
const STATUS_ROLES: readonly Role[] = ["blue", "purple", "green", "red", "amber", "hold"];
const SURFACES = ["bg", "panel", "card", "muted", "hover"] as const;
const TEXT_MIN = 4.5;
const ACCENT_MIN = 3;

const softOf = (roles: Roles, role: Role): string => mix(roles[role], roles.card, 0.1);

const surfacesOf = (roles: Roles, role: Role): string[] => [
  ...SURFACES.map((s) => roles[s]),
  ...(STATUS_ROLES.includes(role) ? [softOf(roles, role)] : []),
];

export function paletteIssues(roles: Roles): PaletteIssue[] {
  const issues: PaletteIssue[] = [];
  for (const role of TEXT_ROLES) {
    const worst = SURFACES.map((on) => ({ on, ratio: contrast(roles[role], roles[on]) })).sort(
      (a, b) => a.ratio - b.ratio,
    )[0];
    if (worst && worst.ratio < TEXT_MIN)
      issues.push({ role, on: worst.on, ratio: worst.ratio, min: TEXT_MIN });
    else if (STATUS_ROLES.includes(role)) {
      const ratio = contrast(roles[role], softOf(roles, role));
      if (ratio < TEXT_MIN) issues.push({ role, on: "soft", ratio, min: TEXT_MIN });
    }
  }
  const accent = contrast(roles.accent, roles.bg);
  if (accent < ACCENT_MIN) issues.push({ role: "accent", on: "bg", ratio: accent, min: ACCENT_MIN });
  return issues;
}

const FIX_PASSES = 6;

export function fixIssues(roles: Roles): Roles {
  let fixed = { ...roles };
  for (let pass = 0; pass < FIX_PASSES; pass++) {
    const issues = paletteIssues(fixed);
    if (issues.length === 0) break;
    const next = { ...fixed };
    for (const { role, min } of issues)
      next[role] = ensureContrast(fixed[role], role === "accent" ? [fixed.bg] : surfacesOf(fixed, role), min);
    fixed = next;
  }
  return fixed;
}
