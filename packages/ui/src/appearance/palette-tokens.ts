import { bestOn, ensureContrast, mix } from "./color-math";
import type { Roles } from "./palette-roles";

const family = (names: readonly string[], value: string): [string, string][] =>
  names.map((name) => [name, value]);

const statusSoft = (color: string, card: string): string => mix(color, card, 0.1);

export function paletteTokens(r: Roles): Record<string, string> {
  return Object.fromEntries([
    ...family(["--background", "--tracking-bg"], r.bg),
    ...family(["--card", "--popover", "--tracking-card"], r.card),
    ...family(["--sidebar", "--tracking-panel"], r.panel),
    ...family(["--muted", "--secondary", "--tracking-muted"], r.muted),
    ...family(["--accent", "--sidebar-accent", "--tracking-hover"], r.hover),
    ...family(["--border", "--sidebar-border", "--tracking-border"], r.border),
    ...family(
      [
        "--foreground",
        "--card-foreground",
        "--popover-foreground",
        "--secondary-foreground",
        "--accent-foreground",
        "--sidebar-foreground",
        "--sidebar-accent-foreground",
        "--tracking-fg",
      ],
      r.fg,
    ),
    ["--tracking-mfg", r.mfg],
    ...family(["--muted-foreground", "--tracking-dim"], r.dim),
    ["--tracking-faint", mix(r.dim, r.bg, 0.6)],
    ["--tracking-soft", mix(r.border, r.card, 0.5)],
    ["--tracking-canvas", mix(r.bg, r.panel, 0.5)],
    ["--tracking-grid", mix(r.border, r.bg, 0.4)],
    ["--tracking-frame", mix(r.bg, r.card, 0.5)],
    ["--input", ensureContrast(r.border, [r.bg, r.card], 3)],
    ...family(["--primary", "--sidebar-primary"], r.accent),
    ...family(["--primary-foreground", "--sidebar-primary-foreground"], bestOn([r.accent])),
    ...family(["--ring", "--sidebar-ring"], ensureContrast(r.accent, [r.bg], 3)),
    ["--tracking-blue", r.blue],
    ["--tracking-purple", r.purple],
    ["--tracking-green", r.green],
    ...family(["--tracking-red", "--destructive", "--color-red-400"], r.red),
    ["--color-purple-400", r.purple],
    ["--tracking-amber", r.amber],
    ["--tracking-hold", r.hold],
    ["--tracking-blue-soft", statusSoft(r.blue, r.card)],
    ["--tracking-purple-soft", statusSoft(r.purple, r.card)],
    ["--tracking-green-soft", statusSoft(r.green, r.card)],
    ["--tracking-red-soft", statusSoft(r.red, r.card)],
    ["--tracking-amber-soft", statusSoft(r.amber, r.card)],
    ["--tracking-hold-soft", statusSoft(r.hold, r.card)],
    ["--tracking-on-fill", bestOn([r.blue, r.purple, r.red])],
    ...family(["--brand", "--tracking-brand"], r.agent),
    ...family(["--brand-strong", "--tracking-brand-btn"], ensureContrast(r.agent, ["#FFFFFF"], 4.5)),
    ["--tracking-brand-text", ensureContrast(r.agent, [r.card, r.muted, r.hover], 4.5)],
    ["--tracking-brand-soft", mix(r.agent, r.card, 0.16)],
    ["--tracking-brand-line", mix(r.agent, r.card, 0.5)],
  ]);
}

export const PALETTE_TOKEN_NAMES: readonly string[] = Object.keys(
  paletteTokens({
    bg: "#000000",
    panel: "#000000",
    card: "#000000",
    muted: "#000000",
    hover: "#000000",
    border: "#000000",
    fg: "#000000",
    mfg: "#000000",
    dim: "#000000",
    blue: "#000000",
    purple: "#000000",
    green: "#000000",
    red: "#000000",
    amber: "#000000",
    hold: "#000000",
    accent: "#000000",
    agent: "#000000",
  }),
);
