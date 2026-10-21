// 0.29.0-alpha.3 (spec §43) : réveil de l'agent de projet sur une réponse. Le board « Agent · réveil sur réponse » est retiré avec la vue
// Suivi (spec §46.3) ; sa rangée reste réservée (après celles de l'alpha 2) pour ne pas décaler les boards suivants.
const S = storage;
Object.assign(S.ICONS, {
  "alarm-clock": '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/>' });
S.Y_A3 = S.Y_A2 + S.STEP27 * S.ROWS_A2.length;
S.ROWS_A3 = ["p-agent-reveil"];
S.NAMES_A3 = { "p-agent-reveil": "Agent · réveil sur réponse" };
S.drawA3k = {};

// « Agent · réveil sur réponse » : board retiré (spec §46.3), rangée gardée ; la conversation est dessinée par 59d-agent-conversation.js.
S.drawA3k["p-agent-reveil"] = () => null;

// ---------- Dessin (export : 90-export.js, S.exportA3) ----------
S.drawA3 = async (key, mode) => { await S.page("Proposition"); S.setMode(mode);
  const i = S.ROWS_A3.indexOf(key), x = mode === "light" ? 1540 : 0, y = S.Y_A3 + i * S.STEP27;
  for (const b of penpot.currentPage.root.children.filter(c => c.y === y && c.x === x)) b.remove();
  if (!S.drawA3k[key]()) return { board: null };
  S.placed = []; const f = S.rename(S.cloneScreen("Agent · question", x, y), S.NAMES_A3[key]);
  const refonts = await S.withRefont(() => S.drawA3k[key](f)); await S.wait(400); const moved = S.replace();
  return { board: f.name, shapes: S.count(f), moved, refonts }; };
return "alpha 3 reveil ok";
