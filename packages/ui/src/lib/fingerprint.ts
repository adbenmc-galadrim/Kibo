export function groupFingerprint(hex: string): string {
  return (hex.match(/.{1,4}/g) ?? []).join(" ");
}

export function fingerprintHead(hex: string): string {
  return `${groupFingerprint(hex.slice(0, 8))} …`;
}
