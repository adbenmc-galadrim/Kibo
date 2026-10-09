import type { Notice } from "../agents/notifier";
import type { Orchestrator } from "../agents/orchestrator";
import type { Docs } from "../docs";
import type { Service } from "../service";
import { createProjectAgentService, type ProjectAgentService } from "./service";
import { openProjectAgentStore } from "./store";
import { unwiredProjectAgentData, unwiredProjectAgentOps } from "./unwired";

export type ProjectAgentBoot = { agent: ProjectAgentService; stop(): void };

export function startProjectAgent(input: {
  home: string;
  service: Pick<Service, "deliverAnswers" | "attachProjectAgent"> & { docs: Pick<Docs, "emit"> };
  orchestrator: () => Orchestrator;
  notify: (notice: Notice) => void;
}): ProjectAgentBoot {
  const store = openProjectAgentStore(input.home);
  const agent = createProjectAgentService({
    store,
    data: unwiredProjectAgentData,
    ops: unwiredProjectAgentOps,
    agents: () => ({ ...input.orchestrator(), deliverAnswers: input.service.deliverAnswers }),
    notify: input.notify,
    emit: () => input.service.docs.emit({ topic: "agents" }),
  });
  const detach = input.service.attachProjectAgent(agent);
  return {
    agent,
    stop() {
      detach();
      store.close();
    },
  };
}
