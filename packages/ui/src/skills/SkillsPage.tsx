import type { ProjectSummary, SkillId } from "@kibo/schema";
import { fr } from "../i18n/fr";

type Props = { projects: ProjectSummary[]; initialSkill?: SkillId };

export function SkillsPage({ initialSkill }: Props) {
  return (
    <section aria-label={fr.nav.skills} data-skill={initialSkill} className="grid content-start gap-3 p-6">
      <p className="text-sm text-muted-foreground">{fr.lazy.loading}</p>
    </section>
  );
}
