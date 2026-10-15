export function subagentItem(root: HTMLElement | null, subagentId: string): HTMLElement | undefined {
  const items = root ? Array.from(root.querySelectorAll<HTMLElement>("li[data-subagent]")) : [];
  return items.find((el) => el.dataset.subagent === subagentId);
}
