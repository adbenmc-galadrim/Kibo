import type { ServerDb } from "./db";
import { ProjectRoom, type RoomLimits } from "./room";

type Entry = { room: ProjectRoom; connections: Set<string>; idleSince: number | null };

export class RoomRegistry {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly sdb: ServerDb,
    private readonly opts: { now: () => number; unloadAfterMs: number; limits?: Partial<RoomLimits> },
  ) {}

  get(projectId: string): ProjectRoom {
    return this.entry(projectId).room;
  }

  create(input: Parameters<typeof ProjectRoom.create>[1]): ProjectRoom {
    const room = ProjectRoom.create(this.sdb, input, this.opts.now(), this.opts.limits);
    this.entries.set(input.projectId, { room, connections: new Set(), idleSince: this.opts.now() });
    return room;
  }

  attach(projectId: string, connId: string): void {
    const entry = this.entry(projectId);
    entry.connections.add(connId);
    entry.idleSince = null;
  }

  detach(projectId: string, connId: string): void {
    const entry = this.entries.get(projectId);
    if (!entry) return;
    entry.connections.delete(connId);
    if (entry.connections.size === 0) entry.idleSince = this.opts.now();
  }

  drop(projectId: string): void {
    const entry = this.entries.get(projectId);
    if (!entry) return;
    entry.room.presence.destroy();
    this.entries.delete(projectId);
  }

  sweep(): string[] {
    const now = this.opts.now();
    const unloaded: string[] = [];
    for (const [projectId, entry] of this.entries) {
      if (entry.idleSince !== null && now - entry.idleSince >= this.opts.unloadAfterMs)
        unloaded.push(projectId);
    }
    for (const projectId of unloaded) this.drop(projectId);
    return unloaded;
  }

  loaded(): string[] {
    return [...this.entries.keys()];
  }

  private entry(projectId: string): Entry {
    const existing = this.entries.get(projectId);
    if (existing) return existing;
    const entry: Entry = {
      room: ProjectRoom.load(this.sdb, projectId, this.opts.limits),
      connections: new Set(),
      idleSince: this.opts.now(),
    };
    this.entries.set(projectId, entry);
    return entry;
  }
}
