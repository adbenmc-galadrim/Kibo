export const PENPOT_IDS = {
  team: "11111111-1111-4111-8111-111111111111",
  project: "22222222-2222-4222-8222-222222222222",
  file: "33333333-3333-4333-8333-333333333333",
  page: "44444444-4444-4444-8444-444444444444",
  board: "55555555-5555-4555-8555-555555555555",
  bare: "66666666-6666-4666-8666-666666666666",
};

export const penpotBoardUrl = (instance: string, ids: typeof PENPOT_IDS = PENPOT_IDS): string =>
  `${instance}/#/workspace/${ids.team}/${ids.project}/${ids.file}?page-id=${ids.page}&board-id=${ids.board}`;
