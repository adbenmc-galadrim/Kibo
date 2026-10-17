import type { ComponentProps } from "react";
import { CommandPalette } from "./lazy-dialogs";
import { useOpened } from "./use-opened";
import type { PaletteRequest } from "./use-shell-dialogs";

type Props = Omit<ComponentProps<typeof CommandPalette>, "open" | "onOpenChange" | "newTab"> & {
  request: PaletteRequest | null;
  onClose(): void;
};

export function WorkspacePalette({ request, onClose, ...palette }: Props) {
  const opened = useOpened(request !== null);
  if (!opened) return null;
  return (
    <CommandPalette
      open={request !== null}
      onOpenChange={(o) => !o && onClose()}
      newTab={request?.newTab ?? false}
      {...palette}
    />
  );
}
