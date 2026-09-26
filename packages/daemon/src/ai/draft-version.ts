import { type GrantedPermissions, permissionList } from "@kibo/schema";

const parts = (v: string) => v.split(".").map((n) => Number.parseInt(n, 10));
const signature = (p: GrantedPermissions) => permissionList(p).sort().join("|");

export function bumpVersion(v: string, part: "minor" | "patch"): string {
  const [major = 0, minor = 0, patch = 0] = parts(v);
  return part === "minor" ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}

export function proposeVersion(
  base: { version: string; permissions: GrantedPermissions; configVersion: number } | null,
  next: { permissions: GrantedPermissions; configVersion: number },
): string {
  if (!base) return "0.1.0";
  const same =
    signature(base.permissions) === signature(next.permissions) && base.configVersion === next.configVersion;
  return bumpVersion(base.version, same ? "patch" : "minor");
}
