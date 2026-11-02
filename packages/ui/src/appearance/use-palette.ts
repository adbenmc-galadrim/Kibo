import { useMemo } from "react";
import { useTheme } from "../theme";
import { activeTheme, themesFor } from "./palette-state";
import { parsePalette, useStoredRaw, writePalette } from "./palette-store";

export function usePalette() {
  const scheme = useTheme();
  const raw = useStoredRaw();
  const palette = useMemo(() => parsePalette(raw), [raw]);
  return {
    scheme,
    palette,
    themes: themesFor(palette, scheme),
    active: activeTheme(palette, scheme),
    commit: (next: typeof palette) => writePalette(next, scheme),
  };
}
