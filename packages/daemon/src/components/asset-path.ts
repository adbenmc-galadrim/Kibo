import { ProjectAssetName } from "@kibo/schema";

const FILE_TOKEN = /^[0-9a-f]{64}$/;

export function parseFilePath(pathname: string): { token: string; name: string } | null {
  const parts = pathname.split("/");
  if (parts.length !== 4 || parts[0] !== "" || parts[1] !== "f") return null;
  const [, , token = "", name = ""] = parts;
  if (!FILE_TOKEN.test(token) || !ProjectAssetName.safeParse(name).success) return null;
  return { token, name };
}

const DESIGN_NAME = /^frame\.(png|webp|jpg)$/;

export function parseDesignPath(pathname: string): { token: string; name: string } | null {
  const parts = pathname.split("/");
  if (parts.length !== 4 || parts[0] !== "" || parts[1] !== "d") return null;
  const [, , token = "", name = ""] = parts;
  if (!FILE_TOKEN.test(token) || !DESIGN_NAME.test(name)) return null;
  return { token, name };
}

export function parseEmbedPath(pathname: string): { token: string } | null {
  const parts = pathname.split("/");
  if (parts.length !== 3 || parts[0] !== "" || parts[1] !== "e") return null;
  const token = parts[2] ?? "";
  return FILE_TOKEN.test(token) ? { token } : null;
}
