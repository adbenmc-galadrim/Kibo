import type { ProjectSnapshot } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { useEffect } from "react";
import { fr } from "../i18n/fr";
import { navigate } from "../route";

export function ProjectHome({ project, onNewPage }: { project: ProjectSnapshot; onNewPage: () => void }) {
  const first = project.pages[0];
  useEffect(() => {
    if (first) navigate(project.meta.id, first.id);
  }, [first, project.meta.id]);
  if (first) return null;
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="grid max-w-sm gap-3 text-center">
        <h1 className="text-xl font-semibold">{fr.projectHome.created}</h1>
        <p className="text-muted-foreground">{fr.projectHome.help}</p>
        <Button onClick={onNewPage}>{fr.nav.newPage}</Button>
      </div>
    </div>
  );
}
