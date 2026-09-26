export const frCi = {
  failedTitle: (key: string) => `CI cassée sur ${key}`,
  failedBody: (workflow: string, pr: number) => `${workflow} a échoué sur la PR #${pr}.`,
};
