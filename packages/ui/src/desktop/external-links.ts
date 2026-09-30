export function externalLinkOf(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[target=_blank]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  let url: URL;
  try {
    url = new URL(anchor.href);
  } catch {
    return null;
  }
  return url.protocol === "https:" ? url.href : null;
}

export function installExternalLinks(root: Document, open: (url: string) => Promise<void>): () => void {
  const onClick = (e: MouseEvent) => {
    if (!(e.target instanceof Element)) return;
    const anchor = e.target.closest("a[target=_blank]");
    if (!anchor) return;
    e.preventDefault();
    const url = externalLinkOf(anchor);
    if (url === null) return;
    open(url).catch((err: unknown) => console.error("[kibo] cannot open the external link", err));
  };
  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}
