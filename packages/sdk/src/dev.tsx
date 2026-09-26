import { ComponentManifest, type Surface, type Theme } from "@kibo/schema";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { devFr } from "./dev-fr";
import { DEMO_NOTE_AGES, DEMO_NOTES, seedDemo } from "./fixtures";
import { createMockSdk } from "./mock";
import { SdkProvider } from "./react";
import { Button } from "./ui/button";

const SURFACES: Surface[] = ["widget", "view"];
const THEMES: Theme[] = ["dark", "light"];

const systemTheme = (): Theme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

function DevShell({ manifest, Component }: { manifest: ComponentManifest; Component: ComponentType }) {
  const [surface, setSurface] = useState<Surface>(manifest.kind === "view" ? "view" : "widget");
  const [theme, setTheme] = useState<Theme>(systemTheme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  const mock = useMemo(
    () =>
      createMockSdk(manifest, {
        seed: (run) => seedDemo(run),
        surface,
        notes: DEMO_NOTES,
        noteAges: DEMO_NOTE_AGES,
      }),
    [manifest, surface],
  );
  return (
    <div className="flex min-h-screen flex-col gap-4 bg-background p-4 text-foreground">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {manifest.kind === "both" && (
          <fieldset aria-label={devFr.surface} className="flex gap-2">
            {SURFACES.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={surface === s ? "default" : "outline"}
                onClick={() => setSurface(s)}
              >
                {devFr[s]}
              </Button>
            ))}
          </fieldset>
        )}
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
        <span className="text-muted-foreground">{devFr.hint}</span>
      </div>
      <div
        className={
          surface === "widget"
            ? "h-80 w-[480px] overflow-hidden rounded-lg border bg-card"
            : "flex-1 rounded-lg border"
        }
      >
        <SdkProvider key={surface} sdk={mock.sdk}>
          <Component />
        </SdkProvider>
      </div>
    </div>
  );
}

export function mountDev(manifestInput: unknown, Component: ComponentType): void {
  const manifest = ComponentManifest.parse(manifestInput);
  const root = document.getElementById("root") ?? document.body.appendChild(document.createElement("div"));
  createRoot(root).render(<DevShell manifest={manifest} Component={Component} />);
}
