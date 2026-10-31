import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

type Props = ComponentProps<"button"> & {
  icon?: LucideIcon | null;
  label: string;
  count?: string | null;
  active?: boolean;
  nested?: boolean;
  lead?: ReactNode;
  trail?: ReactNode;
};

export function NavCount({ children, yields = false }: { children: string; yields?: boolean }) {
  return (
    <span aria-hidden className={yields ? "k-count k-yield whitespace-nowrap" : "k-count whitespace-nowrap"}>
      {children}
    </span>
  );
}

export function NavRow({
  icon: Icon,
  label,
  count,
  active = false,
  nested = false,
  lead,
  trail,
  className,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      className={[nested ? "k-row k-nested" : "k-row", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {lead}
      {Icon && <Icon size={15} absoluteStrokeWidth />}
      <span>{label}</span>
      {count && <NavCount>{count}</NavCount>}
      {trail}
    </button>
  );
}
