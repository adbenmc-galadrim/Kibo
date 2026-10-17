import type { Instance } from "@kibo/schema";
import { DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import type { ReactNode } from "react";
import type { Flash } from "../lib/use-flash";
import { useInstanceTitle } from "./InstanceMenu";
import { InstanceMenuContent } from "./InstanceMenuContent";

type Props = {
  projectId: string;
  instance: Instance;
  entries: MenuEntry[];
  flash: Flash["flash"];
  children?: ReactNode;
};

export function PageInstanceMenu({ projectId, instance, entries, flash }: Props) {
  const title = useInstanceTitle(instance.component);
  return (
    <InstanceMenuContent
      projectId={projectId}
      instance={instance}
      title={title}
      flash={flash}
      lead={<DropdownMenuEntries entries={entries} />}
      side="right"
    />
  );
}
