export function formatPairingCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3, 6)}`;
}

export function remaining(expiresAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
