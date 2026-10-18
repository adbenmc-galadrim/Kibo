const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

export const frHome = {
  client: (name: string) => `client ${name}`,
  open: (n: number) => plural(n, "ouvert", "ouverts"),
  blocked: (n: number) => plural(n, "bloqué", "bloqués"),
  late: "en retard",
  sprint: (code: string) => `Sprint ${code}`,
};
