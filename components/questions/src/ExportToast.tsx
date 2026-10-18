import { ActionToast } from "./ActionToast";
import { fr } from "./fr";

type Props = { count: number; undoFailed: boolean; onUndo(): void; onClose(): void };

export function ExportToast({ count, undoFailed, onUndo, onClose }: Props) {
  return (
    <ActionToast
      message={fr.exporting.marked(count)}
      actionLabel={fr.exporting.undo}
      alert={undoFailed ? fr.exporting.undoFailed : null}
      onAction={onUndo}
      onClose={onClose}
    />
  );
}
