import { tmpdir } from "node:os";
import { join } from "node:path";

export const MARKET_PORTS = { dark: 4412, light: 4413, control: 4414 } as const;
export const MARKET_STATE_FILE = join(tmpdir(), "kibo-e2e-market.json");
export type MarketE2eTheme = { market: string; fingerprint: string };
export type MarketE2eState = Record<"dark" | "light", MarketE2eTheme>;
export const MARKET_REVOKE_REASON = "Faille dans le calcul";
