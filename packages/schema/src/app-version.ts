export const APP_VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-alpha\.(\d+))?$/;

export const isAppVersion = (value: string): boolean => APP_VERSION.test(value);

type Parsed = { numbers: [number, number, number]; alpha: number | null };

function parse(version: string): Parsed {
  const m = APP_VERSION.exec(version);
  if (!m) throw new RangeError(`"${version}" is not an application version`);
  return {
    numbers: [Number(m[1]), Number(m[2]), Number(m[3])],
    alpha: m[4] === undefined ? null : Number(m[4]),
  };
}

const sign = (n: number): -1 | 0 | 1 => (n < 0 ? -1 : n > 0 ? 1 : 0);

export function compareAppVersions(a: string, b: string): -1 | 0 | 1 {
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (left.numbers[i] ?? 0) - (right.numbers[i] ?? 0);
    if (d !== 0) return sign(d);
  }
  if (left.alpha === null && right.alpha === null) return 0;
  if (left.alpha === null) return 1;
  if (right.alpha === null) return -1;
  return sign(left.alpha - right.alpha);
}
