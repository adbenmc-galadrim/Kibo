export async function pickFolder(defaultPath: string | null): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({
    directory: true,
    multiple: false,
    ...(defaultPath !== null && { defaultPath }),
  });
  return typeof picked === "string" ? picked : null;
}
