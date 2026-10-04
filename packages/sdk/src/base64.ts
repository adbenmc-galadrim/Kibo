const CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export const base64ToBytes = (encoded: string): Uint8Array =>
  Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
