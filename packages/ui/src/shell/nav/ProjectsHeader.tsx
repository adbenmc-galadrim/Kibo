import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { Plus } from "lucide-react";
import { useState } from "react";
import { fr } from "../../i18n/fr";
import { ProjectAddItems } from "../lazy-screens";

type Props = { onNewProject(): void; onJoin(): void };

export function ProjectsHeader({ onNewProject, onJoin }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="k-label">
      <h2>{fr.nav.projects}</h2>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger aria-label={fr.nav.addProject} className="k-focus">
          <Plus size={13} absoluteStrokeWidth className="k-13" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          {open && <ProjectAddItems onNewProject={onNewProject} onJoin={onJoin} />}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
