const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Version\/[\d.]+.*Safari\//, "Safari"],
];
const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad/, "iOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Android/, "Android"],
  [/Linux|X11/, "Linux"],
  [/Windows/, "Windows"],
];

export function deviceNameFromUserAgent(ua: string | null): string {
  if (!ua) return "Navigateur";
  if (ua.includes("Tauri")) return "Application Kibo";
  if (ua.startsWith("Bun/")) return "Commande kibo";
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1];
  if (!browser) return "Navigateur";
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1];
  return system ? `${browser} · ${system}` : browser;
}
