type Props = { color: string; radius: number; border: number };

export function PenpotStroke({ color, radius, border }: Props) {
  const box = `calc(100% + ${2 * border}px)`;
  return (
    <svg
      aria-hidden="true"
      data-slot="penpot-stroke"
      className="pointer-events-none absolute overflow-visible"
      style={{ inset: -border, width: box, height: box }}
    >
      <rect width="100%" height="100%" rx={radius} fill="none" stroke={color} />
    </svg>
  );
}
