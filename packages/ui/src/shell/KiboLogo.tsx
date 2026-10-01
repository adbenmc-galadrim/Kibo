import { fr } from "../i18n/fr";
import { BRAND, CARD_RADIUS, KIBO_MARK } from "./kibo-mark";

export function KiboLogo({ className, decorative = false }: { className?: string; decorative?: boolean }) {
  const { tile, cards } = KIBO_MARK;
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-hidden={decorative}
      aria-label={fr.app.name}
      fill="none"
    >
      <title>{fr.app.name}</title>
      <rect
        x={tile.x}
        y={tile.y}
        width={tile.size}
        height={tile.size}
        rx={tile.radius}
        strokeWidth={tile.stroke}
        className="fill-card stroke-border text-foreground"
      />
      {cards.map((c) => (
        <rect
          key={`${c.x}-${c.y}`}
          x={c.x}
          y={c.y}
          width={c.w}
          height={c.h}
          rx={CARD_RADIUS}
          fill={c.fill === "brand" ? BRAND : "currentColor"}
          opacity={c.opacity}
          className="text-foreground"
        />
      ))}
    </svg>
  );
}
