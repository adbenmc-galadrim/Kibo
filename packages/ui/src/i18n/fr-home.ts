const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

export const frHome = {
  client: (name: string) => `client ${name}`,
  open: (n: number) => plural(n, "ticket ouvert", "tickets ouverts"),
  blocked: (n: number) => plural(n, "bloqué", "bloqués"),
  late: (n: number) => plural(n, "fonctionnalité en retard", "fonctionnalités en retard"),
  sprint: (code: string) => `Sprint ${code}`,
};
