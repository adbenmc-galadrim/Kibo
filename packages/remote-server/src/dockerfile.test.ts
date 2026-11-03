import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const packageDir = join(import.meta.dir, "..");
const read = (name: string) => Bun.file(join(packageDir, name)).text();
const instructions = (text: string) =>
  text
    .replace(/\\\n\s*/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));

describe("the remote server image", () => {
  test("installs from the lockfile and builds the phone application", async () => {
    const lines = instructions(await read("Dockerfile"));
    expect(lines[0]).toMatch(/^FROM oven\/bun:1\.4\.2-slim\b/);
    expect(lines.some((l) => /^RUN .*bun install --frozen-lockfile/.test(l))).toBe(true);
    expect(lines.some((l) => /^RUN .*bun run build:phone/.test(l))).toBe(true);
    expect(lines.some((l) => /^ARG KIBO_BUILD_ID\b/.test(l))).toBe(true);
  });

  test("runs the server as a non-root user on 8080 with /data and a health check", async () => {
    const lines = instructions(await read("Dockerfile"));
    expect(lines).toContain("EXPOSE 8080");
    expect(lines).toContain('VOLUME ["/data"]');
    expect(lines).toContain("USER bun");
    expect(lines.some((l) => /^ENV .*\bKIBO_REMOTE_STATIC=\S*packages\/phone\/dist/.test(l))).toBe(true);
    expect(lines.find((l) => l.startsWith("HEALTHCHECK"))).toMatch(/127\.0\.0\.1:8080\/api\/health/);
    expect(lines.at(-1)).toMatch(/^CMD \["bun", "packages\/remote-server\/src\/main\.ts"\]$/);
  });

  test("keeps local builds, secrets and dependencies out of the context", async () => {
    const ignored = instructions(await read("Dockerfile.dockerignore"));
    expect(ignored).toEqual(
      expect.arrayContaining(["**/node_modules", "**/dist", ".git", ".claude", "design", "**/.env*"]),
    );
  });
});
