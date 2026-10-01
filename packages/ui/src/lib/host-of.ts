export const hostOf = (url: string): string => (URL.canParse(url) ? new URL(url).host : url);
