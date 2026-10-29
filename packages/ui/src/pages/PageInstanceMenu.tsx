import type { Instance } from "@kibo/schema";
import { DropdownMenuEntries, type MenuEntry } from "@kibo/sdk/ui/menu-entries";
import type { ReactNode } from "react";
import { useInstanceTitle } from "./InstanceMenu";
import { InstanceMenuContent } from "./InstanceMenuContent";

type Props = {
  projectId: string;
  instance: Instance;
  entries: MenuEntry[];
  children?: ReactNode;
};

export function PageInstanceMenu({ projectId, instance, entries }: Props) {
  const title = useInstanceTitle(instance.component);
  return (
    <InstanceMenuContent
      projectId={projectId}
      instance={instance}
      title={title}
      lead={<DropdownMenuEntries entries={entries} />}
      side="right"
    />
  );
}
