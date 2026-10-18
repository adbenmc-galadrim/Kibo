import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectMeta, Ticket } from "@kibo/schema";
import { createService } from "../service";
import { openStore, type Store } from "../store";
import { simulateDemoReview } from "./bootstrap";

const dirs: string[] = [];
const stores: Store[] = [];
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function projectWithDemo4() {
  const home = mkdtempSync(join(tmpdir(), "kibo-demo-review-"));
  dirs.push(home);
  const store = openStore(home);
  stores.push(store);
  const service = createService(store, { user: "adam" });
  const meta = ProjectMeta.parse(
    service.handle({ method: "createProject", name: "Démo", key: "DEMO", folder: null, color: "#F97316" }),
  );
  const run = (title: string, extra: { feature?: true; parentId?: string; statusId?: "in_progress" }) =>
    Ticket.parse(
      service.handle({
        method: "command",
        projectId: meta.id,
        command: { method: "createTicket", title, ...extra },
      }),
    );
  const feature = run("Panier", { feature: true });
  for (const title of ["Un", "Deux", "Trois"]) run(title, { parentId: feature.id });
  const step = run("Paiement", { parentId: feature.id, statusId: "in_progress" });
  const status = () =>
    Ticket.array()
      .parse((service.handle({ method: "getProject", projectId: meta.id }) as { tickets: unknown }).tickets)
      .find((t) => t.id === step.id)?.statusId;
  return { service, projectId: meta.id, step, status };
}

test("a project that is not the demo never receives the simulated pull request", () => {
  const { service, projectId, step, status } = projectWithDemo4();
  expect(step.key).toBe("DEMO-4");
  expect(() => simulateDemoReview(service, () => false, projectId)).toThrow("INVALID_INPUT");
  expect(status()).toBe("in_progress");
});

test("the demo project gets the pull request of DEMO-4, which goes to review", () => {
  const { service, projectId, status } = projectWithDemo4();
  simulateDemoReview(service, (id) => id === projectId, projectId);
  expect(status()).toBe("in_review");
});
