import { expect, test } from "bun:test";
import { aboutText, uptimeLabel } from "./about-text";

const info = {
  version: "1.5.0",
  platform: "darwin",
  arch: "arm64",
  home: "~/.kibo",
  daemonPid: 42,
  uptimeMs: 65_000,
} as const;

test("aboutText lists version, platform, daemon and shell on separate lines", () => {
  const text = aboutText({ ...info, shell: "tauri" }, 4317);
  expect(text.split("\n")).toEqual([
    "Kibo 1.5.0",
    "macOS · Apple Silicon · application de bureau",
    "Démon : PID 42 · port 4317 · ~/.kibo",
    "En marche depuis 1 min",
  ]);
});

test("Linux and Intel names follow the platform, the port is omitted when unknown", () => {
  const text = aboutText({ ...info, platform: "linux", arch: "x64", shell: "browser" }, null);
  expect(text.split("\n").slice(1, 3)).toEqual(["Linux · x86-64 · navigateur", "Démon : PID 42 · ~/.kibo"]);
  expect(aboutText({ ...info, arch: "x64", shell: "browser" }, 1).split("\n")[1]).toBe(
    "macOS · Intel · navigateur",
  );
  expect(aboutText({ ...info, platform: "linux", shell: "browser" }, 1).split("\n")[1]).toBe(
    "Linux · ARM 64 bits · navigateur",
  );
});

test("uptime reads in minutes then hours", () => {
  expect(uptimeLabel(20_000)).toBe("moins d'une minute");
  expect(uptimeLabel(59 * 60_000)).toBe("59 min");
  expect(uptimeLabel(60 * 60_000)).toBe("1 h");
  expect(uptimeLabel(125 * 60_000)).toBe("2 h 5 min");
});
