import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { useId } from "react";
import { frShortcuts } from "../i18n/fr-shortcuts";
import { isMac } from "../lib/shortcut-label";
import { SettingsLayout } from "./SettingsLayout";
import { ShortcutList } from "./ShortcutList";
import { type ShortcutGroup, shortcutGroups } from "./shortcuts";

function Group({ group }: { group: ShortcutGroup }) {
  const id = useId();
  return (
    <Card className="gap-3" role="region" aria-labelledby={id}>
      <CardHeader>
        <CardTitle id={id}>{group.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ShortcutList items={group.items} />
      </CardContent>
    </Card>
  );
}

export function ShortcutsPage() {
  const groups = shortcutGroups(isMac());
  return (
    <SettingsLayout active="shortcuts">
      <div className="flex flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-semibold">{frShortcuts.title}</h1>
          <p className="text-sm text-muted-foreground">{frShortcuts.subtitle}</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {groups.map((g) => (
            <Group key={g.title} group={g} />
          ))}
        </div>
      </div>
    </SettingsLayout>
  );
}
