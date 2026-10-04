export const CHART_UI = (title: string) => `import { useEntities } from "@kibo/sdk";

const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

export function Component() {
  const tickets = useEntities("ticket");
  const statuses = useEntities("status");
  const columns = [...statuses.data]
    .sort((a, b) => a.order - b.order)
    .map((status) => ({ status, count: tickets.data.filter((t) => t.statusId === status.id).length }));
  const highest = Math.max(1, ...columns.map((c) => c.count));
  const width = columns.length > 0 ? 100 / columns.length : 100;
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <h2 className="text-sm font-medium">${title}</h2>
      <div className="flex min-h-0 flex-1 flex-col">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="${title}" className="min-h-0 flex-1">
          {columns.map(({ status, count }, i) => {
            const height = (count / highest) * 36;
            return (
              <rect key={status.id} x={i * width + width * 0.15} y={40 - height} width={width * 0.7} height={height} fill={COLORS[i % COLORS.length]}>
                <title>{\`\${status.label} : \${count}\`}</title>
              </rect>
            );
          })}
        </svg>
        <ul className="flex gap-1 text-xs text-muted-foreground">
          {columns.map(({ status, count }) => (
            <li key={status.id} className="min-w-0 flex-1 truncate text-center">
              {status.label} ({count})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
`;
