import { fr } from "../i18n/fr";

export async function showClosedTabToast(onUndo: () => void): Promise<void> {
  const { toast } = await import("sonner");
  toast(fr.tabs.closed, { action: { label: fr.tabs.undoClose, onClick: onUndo }, duration: 6_000 });
}
