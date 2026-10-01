import { installExternalLinks } from "./external-links";
import { blockNativeContextMenu } from "./native-context-menu";

export async function setNativeTitle(title: string): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setTitle(title);
}

const openExternal = async (url: string): Promise<void> => {
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
};

export function installDesktop(): () => void {
  const offLinks = installExternalLinks(document, openExternal);
  const offMenu = blockNativeContextMenu(document, () => window.getSelection()?.toString() ?? "");
  return () => {
    offLinks();
    offMenu();
  };
}
