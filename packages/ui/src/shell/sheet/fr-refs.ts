export const frRefs = {
  branch: (branch: string) => `Branche ${branch}`,
  base: (base: string) => `Base : ${base}`,
  mergedInto: (base: string) => `fusionnée dans ${base}`,
  imported: (source: string, id: string) => `Importé de ${source} · ${id}`,
};
