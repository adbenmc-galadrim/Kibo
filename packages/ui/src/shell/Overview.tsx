import type { ProjectMeta } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { fr } from "../i18n/fr";
import { navigate } from "../route";

export function Overview({ projects, onNewProject }: { projects: ProjectMeta[]; onNewProject: () => void }) {
  return (
    <div className="grid gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{fr.nav.overview}</h1>
        <Button onClick={onNewProject}>{fr.nav.newProject}</Button>
      </div>
      {projects.length === 0 ? (
        <p className="text-muted-foreground">{fr.overview.empty}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="cursor-pointer" onClick={() => navigate(p.id)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="size-2.5 rounded-[2px]" style={{ background: p.color }} />
                  {p.name}
                  <span className="font-mono text-xs text-muted-foreground">{p.key}</span>
                </CardTitle>
                {p.folder && <CardDescription className="font-mono">{p.folder}</CardDescription>}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
