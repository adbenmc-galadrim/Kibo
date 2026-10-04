# Fond de l'image disque

`background.svg` est la source (660 × 400 points). `background.png` en est le rendu @2x : 1320 × 800, RGBA, 144 dpi, pour que Finder l'affiche à 660 × 400 points. `bundle.macOS.dmg` de `tauri.conf.json` le référence ; `scripts/icons.test.ts` vérifie ses dimensions et son format.

Après une modification du SVG, le rendre depuis la racine du dépôt (Chromium de Playwright, police Geist de l'interface, puis Pillow pour forcer le canal alpha que Chromium retire d'une image opaque) :

```sh
cat > e2e/render-dmg-background.ts <<'TS'
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const svg = readFileSync("../apps/desktop/dmg/background.svg", "utf8");
const font = readFileSync("../packages/ui/node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2").toString("base64");
const html = `<!doctype html><style>@font-face{font-family:Geist;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 900}html,body{margin:0}svg{display:block}</style>${svg}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 660, height: 400 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "../apps/desktop/dmg/background.png", clip: { x: 0, y: 0, width: 660, height: 400 } });
await browser.close();
TS
(cd e2e && bun render-dmg-background.ts) && rm e2e/render-dmg-background.ts
python3 -c "from PIL import Image; Image.open('apps/desktop/dmg/background.png').convert('RGBA').save('apps/desktop/dmg/background.png', optimize=True, dpi=(144, 144))"
bun test apps/desktop/scripts/icons.test.ts
```
