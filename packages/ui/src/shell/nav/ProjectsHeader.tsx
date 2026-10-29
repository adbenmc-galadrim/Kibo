import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Plus } from "lucide-react";
import { fr } from "../../i18n/fr";

type Props = { onNewProject(): void };

export function ProjectsHeader({ onNewProject }: Props) {
  return (
    <div className="k-label">
      <h2>{fr.nav.projects}</h2>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={fr.nav.addProject} className="k-focus">
          <Plus size={13} absoluteStrokeWidth className="k-13" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onSelect={onNewProject}>
            <Plus aria-hidden />
            {fr.nav.newProject}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
