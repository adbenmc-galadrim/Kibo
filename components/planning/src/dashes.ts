const DASH = 11;
const PERIOD = 22;

const px = (n: number): string => `${Math.round(n * 1000) / 1000}px`;

export function dashStops(phase: number, color: string): string {
  const start = (PERIOD - (phase % PERIOD)) % PERIOD;
  const end = start + DASH;
  if (start === 0) return `${color} 0px ${px(DASH)}, transparent ${px(DASH)} ${px(PERIOD)}`;
  if (end <= PERIOD)
    return `transparent 0px ${px(start)}, ${color} ${px(start)} ${px(end)}, transparent ${px(end)} ${px(PERIOD)}`;
  const tail = end - PERIOD;
  return `${color} 0px ${px(tail)}, transparent ${px(tail)} ${px(start)}, ${color} ${px(start)} ${px(PERIOD)}`;
}

type Box = { width: number; height: number; radius: number; color: string };

type DashedSides = {
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
  backgroundRepeat: "no-repeat";
};

export function dashedBorder({ width, height, radius, color }: Box): DashedSides {
  const across = width - 2 * radius;
  const down = height - 2 * radius;
  const corner = (Math.PI * radius) / 2;
  const phases = [0, across + corner, across + down + 2 * corner, 2 * across + down + 3 * corner];
  const directions = ["to right", "to bottom", "to left", "to top"];
  const image = directions
    .map((d, i) => `repeating-linear-gradient(${d}, ${dashStops(phases[i] ?? 0, color)})`)
    .join(", ");
  const r = px(radius);
  return {
    backgroundImage: image,
    backgroundPosition: `${r} 0px, 100% ${r}, ${r} 100%, 0px ${r}`,
    backgroundSize: `${px(across)} 1px, 1px ${px(down)}, ${px(across)} 1px, 1px ${px(down)}`,
    backgroundRepeat: "no-repeat",
  };
}
