const FOLDED = "1";

const bandKey = (projectId: string): string => `kibo.planning.held-band.${projectId}`;

export function readBandFolded(projectId: string): boolean {
  try {
    return localStorage.getItem(bandKey(projectId)) === FOLDED;
  } catch {
    return false;
  }
}

export function writeBandFolded(projectId: string, folded: boolean): void {
  try {
    if (folded) localStorage.setItem(bandKey(projectId), FOLDED);
    else localStorage.removeItem(bandKey(projectId));
  } catch (e) {
    console.warn("[planning] held band state not saved", e);
  }
}
