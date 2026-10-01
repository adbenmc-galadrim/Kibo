import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { fr } from "../i18n/fr";
import { setThemePreference, THEME_PREFERENCES, type ThemePreference, useThemePreference } from "../theme";
import { SettingsLayout } from "./SettingsLayout";

const t = fr.security.appearance;
const SEGMENT =
  "h-7 rounded-md px-3 text-xs text-muted-foreground hover:bg-transparent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm";
const isPreference = (v: string): v is ThemePreference => THEME_PREFERENCES.some((p) => p === v);

export function ThemeSegment() {
  const preference = useThemePreference();
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      aria-label={t.theme}
      className="rounded-lg bg-muted p-[3px]"
      value={preference}
      onValueChange={(v) => {
        if (isPreference(v)) setThemePreference(v);
      }}
    >
      {THEME_PREFERENCES.map((p) => (
        <ToggleGroupItem key={p} value={p} className={SEGMENT}>
          {t[p]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function AppearancePage() {
  return (
    <SettingsLayout active="appearance">
      <div className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>{t.theme}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4 text-sm">
            <p className="text-xs text-muted-foreground">{t.themeHelp}</p>
            <ThemeSegment />
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}
