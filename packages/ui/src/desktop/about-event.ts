import { inTauri } from "../shell/workspace-actions";

export const ABOUT_EVENT = "kibo:about";

export type ListenApi = { listen(event: string, handler: () => void): Promise<unknown> };

const loadEvents = (): Promise<ListenApi> => import("@tauri-apps/api/event");

export function createAboutEvent(
  load: () => Promise<ListenApi>,
  desktop: () => boolean,
): (onAbout: () => void) => void {
  let current: () => void = () => {};
  let listening = false;
  return (onAbout) => {
    current = onAbout;
    if (listening || !desktop()) return;
    listening = true;
    load()
      .then(({ listen }) => listen(ABOUT_EVENT, () => current()))
      .catch((e: unknown) => console.error("about menu event unavailable", e));
  };
}

export const listenAboutEvent = createAboutEvent(loadEvents, inTauri);
