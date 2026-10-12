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

export const renamedNotice = (profileName: string, name: string, existed: boolean): MigrationNotice => ({
  profileName,
  text: existed
    ? `Profil ${profileName} : migré sous le nom ${name} ; un agent de ce nom existait déjà, ses guidelines sont dans l'historique de ${name}`
    : `Profil ${profileName} : migré sous le nom ${name}, son ancien nom n'est pas valide pour Claude Code`,
});

export const unreadableNotice = (profileName: string, name: string): MigrationNotice => ({
  profileName,
  text: `Profil ${profileName} illisible : ses guidelines sont dans l'historique de l'agent ${name}, restaurables depuis cette version`,
});
