import { ChevronRight } from "lucide-react";
import { fr } from "../i18n/fr";

function Crumb({
  label,
  current,
  first,
  heading,
}: {
  label: string;
  current: boolean;
  first: boolean;
  heading: boolean;
}) {
  const Label = current && heading ? "h1" : "span";
  return (
    <li className="flex min-w-0 items-center gap-1.5">
      {!first && <ChevronRight aria-hidden className="size-3.5 shrink-0" />}
      <Label
        aria-current={current ? "page" : undefined}
        className={current ? "truncate font-medium text-foreground" : "truncate"}
      >
        {label}
      </Label>
    </li>
  );
}

export function Breadcrumb({ items, heading = false }: { items: string[]; heading?: boolean }) {
  return (
    <nav aria-label={fr.nav.breadcrumb} className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((label, i) => (
          <Crumb
            key={`${i}-${label}`}
            label={label}
            current={i === items.length - 1}
            first={i === 0}
            heading={heading}
          />
        ))}
      </ol>
    </nav>
  );
}
