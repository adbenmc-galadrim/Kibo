export function fitScale(available: number, width: number): number {
  if (!(available > 0) || !(width > 0) || width <= available) return 1;
  return available / width;
}
