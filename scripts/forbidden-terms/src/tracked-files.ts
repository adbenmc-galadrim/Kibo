export function trackedFiles(root: string): string[] {
  const result = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: root });
  if (result.exitCode !== 0) throw new Error(`git ls-files failed: ${result.stderr.toString()}`);
  return result.stdout
    .toString()
    .split("\0")
    .filter((path) => path.length > 0);
}

export function scopeOf(env: string | undefined): string[] {
  return (env ?? "")
    .split(",")
    .map((prefix) => prefix.trim().replace(/\/+$/, ""))
    .filter((prefix) => prefix.length > 0);
}

export function inScope(path: string, scope: readonly string[]): boolean {
  return scope.length === 0 || scope.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
