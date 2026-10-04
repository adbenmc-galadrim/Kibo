export const TABLE_UI = (title: string) => `import { useEntities, useSdk } from "@kibo/sdk";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { useState } from "react";

type SortKey = "key" | "title" | "status";

export function Component() {
  const sdk = useSdk();
  const tickets = useEntities("ticket");
  const statuses = useEntities("status");
  const [sortKey, setSortKey] = useState<SortKey>("key");
  const labelOf = (id: string) => statuses.data.find((s) => s.id === id)?.label ?? id;
  const rows = tickets.data.map((t) => ({ id: t.id, key: t.key ?? "", title: t.title, status: labelOf(t.statusId) }));
  const sorted = [...rows].sort((a, b) => a[sortKey].localeCompare(b[sortKey]));
  const header = (key: SortKey, label: string) => (
    <TableHead>
      <button type="button" className="font-medium" aria-pressed={sortKey === key} onClick={() => setSortKey(key)}>
        {label}
      </button>
    </TableHead>
  );
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <h2 className="text-sm font-medium">${title}</h2>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {header("key", "Clé")}
              {header("title", "Titre")}
              {header("status", "Statut")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.key}</TableCell>
                <TableCell className="truncate">
                  <button type="button" className="hover:underline" onClick={() => sdk.openTicket(row.id)}>
                    {row.title}
                  </button>
                </TableCell>
                <TableCell>{row.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
`;
