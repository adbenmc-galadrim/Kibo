import { type ComponentProps, forwardRef } from "react";
import { projectInitials } from "./project-initials";

type Props = ComponentProps<"button"> & { name: string; color: string; current: boolean };

export const RailBadge = forwardRef<HTMLButtonElement, Props>(function RailBadge(
  { name, color, current, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={name}
      data-active={current || undefined}
      className="k-row k-rail k-focus"
      {...rest}
    >
      <b aria-hidden className="k-initials" style={{ background: color }}>
        {projectInitials(name)}
      </b>
    </button>
  );
});
