import { describe, expect, test } from "bun:test";
import QRCode from "qrcode";
import { readQrFrame } from "./qr-frame";

const MODULE_PX = 4;
const QUIET_MODULES = 4;

function render(text: string) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const side = (modules.size + QUIET_MODULES * 2) * MODULE_PX;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const row = Math.floor(y / MODULE_PX) - QUIET_MODULES;
      const col = Math.floor(x / MODULE_PX) - QUIET_MODULES;
      const inside = row >= 0 && col >= 0 && row < modules.size && col < modules.size;
      if (!inside || !modules.get(row, col)) continue;
      const at = (y * side + x) * 4;
      data[at] = data[at + 1] = data[at + 2] = 0;
    }
  }
  return { data, width: side, height: side };
}

describe("readQrFrame", () => {
  test("reads a pairing code from a camera frame", () => {
    const code = "kibo1.BXNpbG8tYWNjb3VudC0wMDAxLXRlc3Q";
    expect(readQrFrame(render(code))).toBe(code);
  });

  test("returns null on a frame without a QR code", () => {
    const blank = new Uint8ClampedArray(64 * 64 * 4).fill(255);
    expect(readQrFrame({ data: blank, width: 64, height: 64 })).toBeNull();
  });
});
