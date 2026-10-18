import { useSidebar } from "@kibo/sdk/ui/sidebar";
import { PanelRight } from "lucide-react";
import { fr } from "../../i18n/fr";
import { useNarrowScreen } from "./use-narrow-screen";

export function SidebarToggle({ whenClosed = false }: { whenClosed?: boolean }) {
  const { open, isMobile, toggleSidebar } = useSidebar();
  const railed = useNarrowScreen();
  if (whenClosed && (open || railed) && !isMobile) return null;
  return (
    <button type="button" aria-label={fr.nav.toggleSidebar} className="k-dim k-focus" onClick={toggleSidebar}>
      <PanelRight size={15} absoluteStrokeWidth className="k-15" />
    </button>
  );
}
