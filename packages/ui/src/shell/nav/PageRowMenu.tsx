import type { Instance } from "@kibo/schema";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { SidebarMenuAction } from "@kibo/sdk/ui/sidebar";
import { Ellipsis } from "lucide-react";
import { useState } from "react";
import { fr } from "../../i18n/fr";
import type { Flash } from "../../lib/use-flash";
import { PageInstanceMenu } from "../lazy-screens";

type Props = {
  title: string;
  projectId: string;
  instance: Instance | null;
  entries: MenuEntry[];
  flash: Flash["flash"];
};

export function PageRowMenu({ title, projectId, instance, entries, flash }: Props) {
  const [opened, setOpened] = useState(false);
  const plain = (
    <DropdownMenuContent align="start" side="right">
      <DropdownMenuEntries entries={entries} />
    </DropdownMenuContent>
  );
  return (
    <DropdownMenu onOpenChange={(open) => open && setOpened(true)}>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction
          aria-label={fr.nav.pageActions(title)}
          className="k-page-action top-[5px] right-1 size-5"
        >
          <Ellipsis />
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      {instance && opened ? (
        <PageInstanceMenu projectId={projectId} instance={instance} entries={entries} flash={flash}>
          {plain}
        </PageInstanceMenu>
      ) : (
        plain
      )}
    </DropdownMenu>
  );
}
