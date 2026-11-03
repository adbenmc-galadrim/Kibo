import type { ProjectSummary } from "@kibo/schema";
import { useEffect, useState } from "react";
import { fr } from "../i18n/fr";
import { PhoneHost } from "../phone-host";
import type { Presence, RemoteClient } from "../remote-client";
import type { PhoneTab, Route } from "../route";
import { useAgentPendingCount } from "../use-agent-count";
import type { Navigate } from "../use-route";
import { GraphScreen } from "./graph/GraphScreen";
import { Header } from "./Header";
import { lazyScreen } from "./lazy-screen";
import { OfflineBand } from "./OfflineBand";
import { ProjectPicker } from "./ProjectPicker";
import { TabBar } from "./TabBar";
import { Toasts } from "./Toasts";

const AgentScreen = lazyScreen(() => import("./agent/AgentScreen").then((m) => m.AgentScreen));

const QuestionsScreen = lazyScreen(() =>
  import("./questions/QuestionsScreen").then((m) => m.QuestionsScreen),
);

const KanbanScreen = lazyScreen(() => import("./kanban/KanbanScreen").then((m) => m.KanbanScreen));
const PlanningScreen = lazyScreen(() => import("./planning/PlanningScreen").then((m) => m.PlanningScreen));
const DashboardScreen = lazyScreen(() =>
  import("./dashboard/DashboardScreen").then((m) => m.DashboardScreen),
);
const TicketScreen = lazyScreen(() => import("./ticket/TicketScreen").then((m) => m.TicketScreen));

type ProjectRoute = Extract<Route, { projectId: string }>;

function useProjects(client: RemoteClient): ProjectSummary[] | null {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      client.rpc({ method: "listProjects" }).then(
        (next) => alive && setProjects(next),
        (e: unknown) => console.error("[kibo-phone] project list failed", e),
      );
    void load();
    const off = client.onChange(() => void load());
    return () => {
      alive = false;
      off();
    };
  }, [client]);
  return projects;
}

function usePresence(client: RemoteClient): Presence {
  const [presence, setPresence] = useState(client.presence);
  useEffect(() => {
    setPresence(client.presence());
    return client.onPresence(setPresence);
  }, [client]);
  return presence;
}

const tabOf = (route: Route): PhoneTab => (route.name === "tab" ? route.tab : "graph");

function ProjectShell({
  client,
  route,
  projects,
  navigate,
}: {
  client: RemoteClient;
  route: ProjectRoute;
  projects: ProjectSummary[];
  navigate: Navigate;
}) {
  const [picking, setPicking] = useState(false);
  const presence = usePresence(client);
  const pending = useAgentPendingCount(route.projectId);
  const project = projects.find((p) => p.id === route.projectId) ?? null;
  const tab = route.name === "tab" ? route.tab : null;
  const page =
    route.name === "ticket"
      ? fr.ticket.title
      : route.name === "agent"
        ? fr.agent.title
        : fr.tabs[tabOf(route)];
  const back =
    route.name === "tab"
      ? undefined
      : () => navigate({ name: "tab", projectId: route.projectId, tab: "graph" });
  return (
    <PhoneHost projectId={route.projectId} navigate={navigate}>
      <div className="flex h-dvh flex-col bg-(--tracking-bg) text-(--tracking-fg)">
        {route.name === "agent" ? (
          <AgentScreen
            projectId={route.projectId}
            projectName={project?.name ?? ""}
            presence={presence}
            onBack={() => navigate({ name: "tab", projectId: route.projectId, tab: "graph" })}
          />
        ) : (
          <>
            <Header
              project={project}
              page={page}
              pending={pending}
              onPick={() => setPicking(true)}
              onAgent={() => navigate({ name: "agent", projectId: route.projectId })}
              onBack={back}
            />
            <OfflineBand presence={presence} />
            <main
              className={`min-h-0 flex-1 overscroll-contain ${tab === "graph" ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}
            >
              {tab === "graph" ? (
                <GraphScreen
                  projectId={route.projectId}
                  client={client}
                  writable={presence.macOnline && presence.phoneOnline}
                />
              ) : null}
              {tab === "questions" ? <QuestionsScreen client={client} projectId={route.projectId} /> : null}
              {route.name === "ticket" ? (
                <TicketScreen
                  client={client}
                  projectId={route.projectId}
                  ticketId={route.ticketId}
                  presence={presence}
                  onDeleted={() => navigate({ name: "tab", projectId: route.projectId, tab: "graph" })}
                />
              ) : null}
              {tab === "kanban" ? <KanbanScreen client={client} projectId={route.projectId} /> : null}
              {tab === "planning" ? <PlanningScreen client={client} projectId={route.projectId} /> : null}
              {tab === "dashboard" ? <DashboardScreen client={client} projectId={route.projectId} /> : null}
            </main>
            <TabBar projectId={route.projectId} active={tab} />
          </>
        )}
        <Toasts client={client} />
        {picking ? (
          <ProjectPicker
            projects={projects}
            current={route.projectId}
            onClose={() => setPicking(false)}
            onSelect={(projectId) => {
              setPicking(false);
              navigate({ name: "tab", projectId, tab: tabOf(route) });
            }}
          />
        ) : null}
      </div>
    </PhoneHost>
  );
}

export function Shell({
  client,
  route,
  navigate,
}: {
  client: RemoteClient;
  route: Route;
  navigate: Navigate;
}) {
  const projects = useProjects(client);
  const first = projects?.[0];
  const known = "projectId" in route && projects?.some((p) => p.id === route.projectId);
  useEffect(() => {
    if (!projects || known || !first) return;
    navigate({ name: "tab", projectId: first.id, tab: tabOf(route) }, { replace: true });
  }, [projects, known, first, route, navigate]);
  if (!projects) return <p className="p-6 text-(--tracking-mfg)">{fr.loading}</p>;
  if (!first)
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-2 p-6">
        <h1 className="text-[22px] font-semibold">{fr.empty.title}</h1>
        <p className="text-[15px] text-(--tracking-mfg)">{fr.empty.body}</p>
      </main>
    );
  if (!known || !("projectId" in route)) return null;
  return <ProjectShell client={client} route={route} projects={projects} navigate={navigate} />;
}
