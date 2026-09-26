import type {
  CommandResult,
  ComponentManifest,
  EntityType,
  Link,
  Page,
  ProjectCommand,
  ProjectSnapshot,
  Status,
  StatusId,
  TicketView,
} from "@kibo/schema";
import type { ComponentType } from "react";

export type EntityMap = { ticket: TicketView; status: Status; link: Link; page: Page };
export type NewTicketDefaults = { statusId?: StatusId; parentId?: string | null };
export type FileOpenRequest = { path: string; line?: number | null; origin?: string | null };

export type KiboSdk = {
  instanceId: string;
  config: Record<string, unknown>;
  viewer: string;
  list<T extends EntityType>(type: T): Promise<EntityMap[T][]>;
  run<C extends ProjectCommand>(cmd: C): Promise<CommandResult[C["method"]]>;
  subscribe(listener: () => void): () => void;
  openTicket(ticketId: string): void;
  openNewTicket(defaults: NewTicketDefaults): void;
  openFile(request: FileOpenRequest): void;
};

export type ProjectBackend = {
  snapshot(): Promise<ProjectSnapshot>;
  run(cmd: ProjectCommand): Promise<unknown>;
  subscribe(listener: () => void): () => void;
};

export type SdkContext = Pick<
  KiboSdk,
  "instanceId" | "config" | "viewer" | "openTicket" | "openNewTicket" | "openFile"
>;

export type ComponentModule = { manifest: ComponentManifest; Component: ComponentType };
