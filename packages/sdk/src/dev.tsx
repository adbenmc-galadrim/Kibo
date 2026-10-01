import {
  type ComponentFormat,
  ComponentManifest,
  defaultFormatOf,
  FORMAT_SIZES,
  formatsOf,
  GRID_COLUMNS,
  surfaceFor,
  type Theme,
} from "@kibo/schema";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { devFr } from "./dev-fr";
import { DEMO_NOTE_AGES, DEMO_NOTES, seedDemo } from "./fixtures";
import { createMockSdk } from "./mock";
import { SdkProvider } from "./react";
import { Button } from "./ui/button";

const THEMES: Theme[] = ["dark", "light"];
const PREVIEW_WIDTH = 1200;
const ROW_HEIGHT = 80;
const GAP = 16;

function formatBox(format: ComponentFormat): { width: number; height: number } {
  const { w, h } = FORMAT_SIZES[format];
  const columns = PREVIEW_WIDTH - (GRID_COLUMNS - 1) * GAP;
  return {
    width: Math.round((w * columns) / GRID_COLUMNS + (w - 1) * GAP),
    height: h * ROW_HEIGHT + (h - 1) * GAP,
  };
}

const systemTheme = (): Theme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

function DevShell({ manifest, Component }: { manifest: ComponentManifest; Component: ComponentType }) {
  const [format, setFormat] = useState<ComponentFormat>(() => defaultFormatOf(manifest));
  const [theme, setTheme] = useState<Theme>(systemTheme);
  const surface = surfaceFor(manifest, format);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  const mock = useMemo(
    () =>
      createMockSdk(manifest, {
        seed: (run) => seedDemo(run),
        surface,
        format,
        notes: DEMO_NOTES,
        noteAges: DEMO_NOTE_AGES,
      }),
    [manifest, surface, format],
  );
  return (
    <div className="flex min-h-screen flex-col gap-4 bg-background p-4 text-foreground">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <fieldset aria-label={devFr.format} className="flex gap-2">
          {formatsOf(manifest).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={format === f ? "default" : "outline"}
              onClick={() => setFormat(f)}
            >
              {devFr.formats[f]}
            </Button>
          ))}
        </fieldset>
        <fieldset aria-label={devFr.theme} className="flex gap-2">
          {THEMES.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={theme === t ? "default" : "outline"}
              onClick={() => setTheme(t)}
            >
              {devFr[t]}
            </Button>
          ))}
        </fieldset>
        <span className="text-muted-foreground">
          {devFr.surface} : {devFr[surface]}
        </span>
        <span className="text-muted-foreground">{devFr.hint}</span>
      </div>
      <div className="overflow-auto">
        <div
          data-format={format}
          style={formatBox(format)}
          className={`@container overflow-hidden rounded-lg border ${surface === "widget" ? "bg-card" : "bg-background"}`}
        >
          <SdkProvider key={format} sdk={mock.sdk}>
            <Component />
          </SdkProvider>
        </div>
      </div>
    </div>
  );
}

export function mountDev(manifestInput: unknown, Component: ComponentType): void {
  const manifest = ComponentManifest.parse(manifestInput);
  const root = document.getElementById("root") ?? document.body.appendChild(document.createElement("div"));
  createRoot(root).render(<DevShell manifest={manifest} Component={Component} />);
}
