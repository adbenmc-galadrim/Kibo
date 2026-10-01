export type OutgoingLink = { url: string | null };

const parse = (href: string): URL | null => {
  try {
    return new URL(href);
  } catch {
    return null;
  }
};

const isSameOrigin = (url: URL, origin: string): boolean => url.origin !== "null" && url.origin === origin;

export function externalLinkOf(target: EventTarget | null, origin: string): OutgoingLink | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  const url = parse(anchor.href);
  if (url === null) return { url: null };
  const newTab = anchor.target.toLowerCase() === "_blank";
  if (!newTab && isSameOrigin(url, origin)) return null;
  return { url: url.protocol === "https:" ? url.href : null };
}

export function installExternalLinks(root: Document, open: (url: string) => Promise<void>): () => void {
  const intercept = (e: MouseEvent) => {
    const link = externalLinkOf(e.target, root.location.origin);
    if (link === null) return;
    e.preventDefault();
    if (link.url === null) return;
    open(link.url).catch((err: unknown) => console.error("[kibo] cannot open the external link", err));
  };
  const onAuxClick = (e: MouseEvent) => {
    if (e.button === 1) intercept(e);
  };
  root.addEventListener("click", intercept);
  root.addEventListener("auxclick", onAuxClick);
  return () => {
    root.removeEventListener("click", intercept);
    root.removeEventListener("auxclick", onAuxClick);
  };
}
