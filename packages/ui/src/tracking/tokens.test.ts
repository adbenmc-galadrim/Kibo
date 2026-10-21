import { expect, test } from "bun:test";

const css = await Bun.file(new URL("../index.css", import.meta.url)).text();
const fontsDir = new URL("../../public/fonts/", import.meta.url);

function declarations(selector: string): Map<string, string> {
  const found = new Map<string, string>();
  const blocks = css.matchAll(/(^|\n)([^{}\n]+)\{([^{}]*)\}/g);
  for (const [, , head, body] of blocks) {
    if (head?.trim() !== selector || body === undefined) continue;
    for (const [, name, value] of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g))
      if (name && value) found.set(name, value.trim());
  }
  return found;
}

const fontFaces = (): string[] =>
  [...css.matchAll(/@font-face\s*\{([^{}]*)\}/g)].map(([, body]) => body ?? "");

const LAYOUT: Record<string, string> = {
  "--tracking-sidebar-w": "240px",
  "--tracking-topbar-h": "48px",
  "--tracking-agent-panel-w": "340px",
  "--tracking-aside-w": "320px",
  "--tracking-content-pad-y": "18px",
  "--tracking-content-pad-x": "24px",
  "--tracking-gap": "14px",
  "--tracking-sprint-col-w": "214px",
  "--tracking-sprint-col-gap": "12px",
  "--tracking-sprint-col-pad": "10px",
  "--tracking-sprint-col-radius": "10px",
  "--tracking-card-radius": "8px",
  "--tracking-card-pad-y": "10px",
  "--tracking-card-pad-x": "12px",
  "--tracking-control-radius": "6px",
  "--tracking-chip-radius": "4px",
  "--tracking-row-h": "40px",
  "--tracking-row-pad-x": "14px",
  "--tracking-row-gap": "12px",
  "--tracking-step-h": "8px",
  "--tracking-step-gap": "3px",
  "--tracking-step-radius": "2px",
  "--tracking-delivery-seg-w": "4px",
  "--tracking-delivery-seg-h": "10px",
  "--tracking-delivery-seg-gap": "1.5px",
  "--tracking-text-xs": "11px",
  "--tracking-text-sm": "12px",
  "--tracking-text-base": "13px",
  "--tracking-text-lg": "14px",
  "--tracking-text-title": "22px",
};

const COLORS: Record<string, [light: string, dark: string]> = {
  "--tracking-bg": ["#ffffff", "#09090b"],
  "--tracking-panel": ["#fafafa", "#0c0c0e"],
  "--tracking-card": ["#ffffff", "#111113"],
  "--tracking-muted": ["#f4f4f5", "#18181b"],
  "--tracking-hover": ["#f4f4f5", "#1c1c1f"],
  "--tracking-border": ["#e4e4e7", "#27272a"],
  "--tracking-soft": ["#eeeef0", "#1f1f23"],
  "--tracking-fg": ["#09090b", "#fafafa"],
  "--tracking-mfg": ["#52525b", "#a1a1aa"],
  "--tracking-dim": ["#71717a", "#71717a"],
  "--tracking-faint": ["#a1a1aa", "#52525b"],
  "--tracking-brand": ["#ea580c", "#f97316"],
  "--tracking-brand-btn": ["#c2410c", "#c2410c"],
  "--tracking-brand-soft": ["#fff7ed", "#2a1406"],
  "--tracking-brand-line": ["#fdba74", "#7c2d12"],
  "--tracking-brand-text": ["#c2410c", "#fb923c"],
  "--tracking-blue": ["#2563eb", "#3b82f6"],
  "--tracking-purple": ["#9333ea", "#a855f7"],
  "--tracking-green": ["#16a34a", "#22c55e"],
  "--tracking-red": ["#dc2626", "#ef4444"],
  "--tracking-amber": ["#d97706", "#f59e0b"],
  "--tracking-blue-soft": ["#eff6ff", "#0b1426"],
  "--tracking-purple-soft": ["#faf5ff", "#1a1024"],
  "--tracking-green-soft": ["#f0fdf4", "#0d1f12"],
  "--tracking-red-soft": ["#fef2f2", "#2a0f0f"],
  "--tracking-amber-soft": ["#fffbeb", "#1f1608"],
  "--tracking-hold": ["#0e7490", "#22d3ee"],
  "--tracking-hold-soft": ["#ecfeff", "#082f35"],
  "--tracking-canvas": ["#fafafa", "#0b0b0d"],
  "--tracking-grid": ["#ededef", "#1a1a1d"],
};

const SPRINT_TINTS: Record<string, string> = {
  "--tracking-sprint-bg": "var(--tracking-panel)",
  "--tracking-sprint-border": "var(--tracking-border)",
  "--tracking-sprint-current-bg": "var(--tracking-card)",
  "--tracking-sprint-current-border": "var(--tracking-mfg)",
};

test("the tracking layout measures from the mockups are declared once for both themes", () => {
  const root = declarations(":root");
  const dark = declarations(".dark");
  for (const [name, value] of Object.entries({ ...LAYOUT, ...SPRINT_TINTS })) {
    expect(root.get(name), name).toBe(value);
    expect(dark.has(name), name).toBe(false);
  }
});

test("the tracking colors follow the mockup tokens in light and in dark", () => {
  const root = declarations(":root");
  const dark = declarations(".dark");
  for (const [name, [light, darkValue]] of Object.entries(COLORS)) {
    expect(root.get(name)?.toLowerCase(), name).toBe(light);
    expect(dark.get(name)?.toLowerCase(), name).toBe(darkValue);
  }
});

test("Geist and Geist Mono are served from the package fonts with swap", () => {
  const faces = fontFaces();
  for (const [family, file] of [
    ["Geist", "Geist[wght].woff2"],
    ["Geist Mono", "GeistMono[wght].woff2"],
  ] as const) {
    const face = faces.find((body) => body.includes(`font-family: "${family}";`));
    expect(face, family).toBeDefined();
    expect(face).toContain(`src: url("/fonts/${file}") format("woff2");`);
    expect(face).toContain("font-display: swap;");
    expect(face).toContain("font-weight: 100 900;");
  }
  expect(declarations(":root").get("--font-sans")?.startsWith('"Geist",')).toBe(true);
  expect(declarations(":root").get("--font-mono")?.startsWith('"Geist Mono",')).toBe(true);
});

test("the font files and their OFL license ship in the public folder", async () => {
  for (const file of ["Geist[wght].woff2", "GeistMono[wght].woff2"]) {
    const bytes = new Uint8Array(await Bun.file(new URL(file, fontsDir)).arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 4)), file).toBe("wOF2");
  }
  expect(await Bun.file(new URL("LICENSE-geist.txt", fontsDir)).text()).toContain(
    "SIL Open Font License, Version 1.1",
  );
});
