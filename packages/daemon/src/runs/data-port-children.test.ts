import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectMeta, Ticket } from "@kibo/schema";
import { call, createService } from "../service";
import { openStore } from "../store";

test("the ticket context counts the direct children of the ticket", () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-port-"));
  try {
    const s = createService(openStore(dir), { user: "adam" });
    const meta = call(s, {
      method: "createProject",
      name: "Silo",
      key: "SILO",
      folder: null,
      color: "#F97316",
    }) as ProjectMeta;
    const create = (title: string, parentId: string | null = null) =>
      call(s, {
        method: "command",
        projectId: meta.id,
        command: { method: "createTicket", title, parentId },
      }) as Ticket;
    const parent = create("C3");
    const child = create("C3-1", parent.id);
    create("C3-2", parent.id);
    create("C3-1-a", child.id);
    expect(s.agentData.ticketContext(meta.id, parent.id).childCount).toBe(2);
    expect(s.agentData.ticketContext(meta.id, child.id).childCount).toBe(1);
    expect(s.agentData.ticketContext(meta.id, create("Feuille").id).childCount).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
