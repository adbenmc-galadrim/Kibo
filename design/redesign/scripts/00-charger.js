// À exécuter dans le plugin MCP après chaque connexion : recharge les helpers dans storage (receiver.py sur 127.0.0.1:8787).
storage.sleep = (fn, ms = 0) => { if (ms < 30) Promise.resolve().then(fn); else fetch("http://127.0.0.1:8787/sleep?ms=" + ms).then(fn, fn); return 0; };
// Date.now() lève une erreur dans le compartiment du plugin (Chromium headless) : un compteur contourne le cache.
storage.n = storage.n || 0;
storage.load = async (n) => new Compartment({ storage, penpot, penpotUtils, setTimeout: storage.sleep, fetch, console, Promise })
  .evaluate("(async()=>{" + await (await fetch("http://127.0.0.1:8787/" + n + "?t=" + (storage.n++))).text() + "\n})()");
const out = [];
for (const n of ["01-base", "02-data", "10-shell", "20-piste-a", "30-piste-b", "40-piste-c", "50-proposition", "55-proposition-v2", "55-phase-27", "56-phase-29", "57-alpha2-questions", "58-alpha3-reveil", "59-graphe-prs", "59b-apercu-maquette", "59c-graphe-attente", "60-styles", "70-vues", "80-choix", "90-export"]) {
  try { out.push(await storage.load(n + ".js")); } catch (e) { out.push(n + " : " + String(e).slice(0, 200)); }
}
return out;
