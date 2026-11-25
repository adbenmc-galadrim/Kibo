export const PHONE_TABS = ["graph", "kanban", "planning", "questions", "dashboard"] as const;
export type PhoneTab = (typeof PHONE_TABS)[number];

export type Route =
  | { name: "home" }
  | { name: "tab"; projectId: string; tab: PhoneTab }
  | { name: "ticket"; projectId: string; ticketId: string }
  | { name: "agent"; projectId: string }
  | { name: "pair" }
  | { name: "login" };

const isTab = (value: string): value is PhoneTab => PHONE_TABS.some((tab) => tab === value);

const decode = (part: string | undefined): string | null => {
  if (!part) return null;
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
};

function projectRoute(projectId: string, rest: string[]): Route {
  const [first, second] = rest;
  if (first === undefined) return { name: "tab", projectId, tab: "graph" };
  if (first === "agent" && rest.length === 1) return { name: "agent", projectId };
  const ticketId = decode(second);
  if (first === "t" && ticketId && rest.length === 2) return { name: "ticket", projectId, ticketId };
  if (isTab(first) && rest.length === 1) return { name: "tab", projectId, tab: first };
  return { name: "home" };
}

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/");
  if (parts.length === 1 && parts[0] === "pair") return { name: "pair" };
  if (parts.length === 1 && parts[0] === "login") return { name: "login" };
  const projectId = decode(parts[1]);
  if (parts[0] !== "p" || !projectId) return { name: "home" };
  return projectRoute(projectId, parts.slice(2));
}

export function formatRoute(route: Route): string {
  const project = "projectId" in route ? `#/p/${encodeURIComponent(route.projectId)}` : "";
  switch (route.name) {
    case "home":
      return "#/";
    case "pair":
    case "login":
      return `#/${route.name}`;
    case "tab":
      return `${project}/${route.tab}`;
    case "ticket":
      return `${project}/t/${encodeURIComponent(route.ticketId)}`;
    case "agent":
      return `${project}/agent`;
  }
}
