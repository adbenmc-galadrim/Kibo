import type { MigrationNotice } from "@kibo/schema";

export type NoticeBox = { add(notices: readonly MigrationNotice[]): void; take(): MigrationNotice[] };

export const existingAgentNotice = (profileName: string): MigrationNotice => ({
  profileName,
  text: `Profil ${profileName} : un agent du même nom existait déjà, ses guidelines sont dans l'historique`,
});

export function createNoticeBox(initial: readonly MigrationNotice[] = []): NoticeBox {
  let pending = [...initial];
  return {
    add(notices) {
      pending.push(...notices);
    },
    take() {
      const taken = pending;
      pending = [];
      return taken;
    },
  };
}
