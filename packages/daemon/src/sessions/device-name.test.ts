import { expect, test } from "bun:test";
import { deviceNameFromUserAgent } from "./device-name";

test.each([
  [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
    "Chrome · macOS",
  ],
  ["Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0", "Firefox · Linux"],
  [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
    "Safari · macOS",
  ],
  ["Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Tauri/2.0", "Application Kibo"],
  [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 Version/17.6 Mobile Safari/604.1",
    "Safari · iOS",
  ],
  ["Bun/1.4.2", "Commande kibo"],
  ["curl/8.7.1", "Navigateur"],
  [null, "Navigateur"],
])("%s ⇒ %s", (ua, name) => {
  expect(deviceNameFromUserAgent(ua)).toBe(name);
});
