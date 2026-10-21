import { afterEach, beforeEach, expect, test } from "bun:test";
import { answered, exited } from "./run-log.test-helper";
import { type Kit, PROJECT_ID, serviceKit } from "./service.test-helper";

let kit: Kit;
beforeEach(() => {
  kit = serviceKit();
});
afterEach(() => kit.cleanup());

test("the view carries the title and message count of the open session and of each past one", () => {
  const first = kit.svc.send(PROJECT_ID, "Fais le point");
  kit.logs.set(first.id, [answered(1, "Fais le point"), exited(2, "F3 est livrée.")]);
  expect(kit.svc.view(PROJECT_ID).session).toMatchObject({ title: "Fais le point", messages: 2 });
  kit.svc.reset(PROJECT_ID);
  const second = kit.svc.send(PROJECT_ID, "Relances client");
  kit.logs.set(second.id, [answered(3, "Relances client")]);
  const view = kit.svc.view(PROJECT_ID);
  expect(view.past[0]).toMatchObject({ runId: first.id, title: "Fais le point", messages: 2 });
  expect(view.session).toMatchObject({ runId: second.id, title: "Relances client", messages: 1 });
  kit.runs.delete(first.id);
  expect(kit.svc.view(PROJECT_ID).past[0]).toMatchObject({ runId: first.id, title: null, messages: 0 });
});
