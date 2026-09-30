export const APP_TITLE = "Kibo";

export function windowTitle(tabTitle: string | null): string {
  return tabTitle ? `${tabTitle} — ${APP_TITLE}` : APP_TITLE;
}
