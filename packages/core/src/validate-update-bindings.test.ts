import { describe, expect, test } from "bun:test";
import type { Binding } from "@kibo/schema";
import { LoroDoc, LoroMap } from "loro-crdt";
import {
  addBinding,
  createProjectDoc,
  createTicket,
  enableServerAllocation,
  removeBinding,
  type UpdateAuthor,
  type UpdateVerdict,
  validateProjectUpdate,
  writeMembers,
} from "./index";

const meta = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" };
const ADAM: UpdateAuthor = { userId: "u-adam", role: "owner" };
const LEA: UpdateAuthor = { userId: "u-lea", role: "editor" };
const MAX: UpdateAuthor = { userId: "u-max", role: "editor" };

const adamsBinding: Binding = {
  id: "b-adam",
  adapter: "github-issues",
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  createdBy: "u-adam",
  runner: "u-adam",
};
const leasBinding: Binding = { ...adamsBinding, id: "b-lea", createdBy: "u-lea", runner: "u-lea" };

function sharedServer(): LoroDoc {
  const doc = createProjectDoc(meta);
  createTicket(doc, { title: "Noyau" });
  doc.getMap("meta").delete("folder");
  doc.commit();
  enableServerAllocation(doc);
  writeMembers(doc, [
    { userId: "u-adam", name: "Adam" },
    { userId: "u-lea", name: "Léa" },
    { userId: "u-max", name: "Max" },
  ]);
  addBinding(doc, adamsBinding);
  addBinding(doc, leasBinding);
  return doc;
}

function verdictFor(author: UpdateAuthor, edit: (client: LoroDoc) => void): UpdateVerdict {
  const server = sharedServer();
  const client = new LoroDoc();
  client.import(server.export({ mode: "update" }));
  edit(client);
  client.commit();
  const after = server.fork();
  after.import(client.export({ mode: "update", from: server.oplogVersion() }));
  return validateProjectUpdate(server, after, author);
}

const refusedAbout = (text: string) => ({ ok: false, reason: expect.stringContaining(text) });
const bindings = (doc: LoroDoc) => doc.getMap("bindings");
const rewrite = (doc: LoroDoc, binding: Binding, patch: Partial<Binding>) =>
  bindings(doc).set(binding.id, { ...binding, ...patch });
const withRepo = (binding: Binding, repo: string): Binding => ({
  ...binding,
  config: { ...binding.config, repo },
});

describe("an editor creating a binding", () => {
  test("runs it on their own account", () => {
    const verdict = verdictFor(LEA, (c) =>
      addBinding(c, { ...leasBinding, id: "b-new", config: { ...leasBinding.config, repo: "lea/notes" } }),
    );
    expect(verdict).toEqual({ ok: true });
  });

  test("cannot make another member run it", () => {
    const verdict = verdictFor(LEA, (c) =>
      addBinding(c, {
        ...leasBinding,
        id: "b-new",
        runner: "u-adam",
        config: withRepo(leasBinding, "lea/trap").config,
      }),
    );
    expect(verdict).toEqual(refusedAbout("b-new"));
  });

  test("cannot claim another member created it", () => {
    const verdict = verdictFor(LEA, (c) =>
      addBinding(c, { ...leasBinding, id: "b-new", createdBy: "u-adam" }),
    );
    expect(verdict).toEqual(refusedAbout("b-new"));
  });

  test("an owner is bound by the same rule", () => {
    const verdict = verdictFor(ADAM, (c) => addBinding(c, { ...adamsBinding, id: "b-new", runner: "u-lea" }));
    expect(verdict).toEqual(refusedAbout("b-new"));
  });
});

describe("changing the config of a binding", () => {
  test("is refused to anyone but its runner", () => {
    const verdict = verdictFor(LEA, (c) => rewrite(c, adamsBinding, withRepo(adamsBinding, "adam/private")));
    expect(verdict).toEqual(refusedAbout("b-adam"));
  });

  test("is refused to an owner who is not the runner", () => {
    const verdict = verdictFor(ADAM, (c) => rewrite(c, leasBinding, withRepo(leasBinding, "lea/private")));
    expect(verdict).toEqual(refusedAbout("b-lea"));
  });

  test("is accepted from its runner", () => {
    const verdict = verdictFor(ADAM, (c) => rewrite(c, adamsBinding, withRepo(adamsBinding, "adam/other")));
    expect(verdict).toEqual({ ok: true });
  });
});

describe("changing the runner of a binding", () => {
  test("an editor cannot take over another member's binding", () => {
    expect(verdictFor(MAX, (c) => rewrite(c, leasBinding, { runner: "u-max" }))).toEqual(
      refusedAbout("b-lea"),
    );
  });

  test("its creator takes it back", () => {
    const server = sharedServer();
    bindings(server).set("b-lea", { ...leasBinding, runner: "u-adam" });
    server.commit();
    const client = new LoroDoc();
    client.import(server.export({ mode: "update" }));
    rewrite(client, leasBinding, { runner: "u-lea" });
    client.commit();
    const after = server.fork();
    after.import(client.export({ mode: "update", from: server.oplogVersion() }));
    expect(validateProjectUpdate(server, after, LEA)).toEqual({ ok: true });
  });

  test("an owner takes it over on their own account", () => {
    expect(verdictFor(ADAM, (c) => rewrite(c, leasBinding, { runner: "u-adam" }))).toEqual({ ok: true });
  });

  test("an owner cannot hand it to a third member", () => {
    expect(verdictFor(ADAM, (c) => rewrite(c, leasBinding, { runner: "u-max" }))).toEqual(
      refusedAbout("b-lea"),
    );
  });

  test("its creator cannot hand it to a third member", () => {
    expect(verdictFor(LEA, (c) => rewrite(c, leasBinding, { runner: "u-max" }))).toEqual(
      refusedAbout("b-lea"),
    );
  });

  test("an owner takes over and reconfigures in one batch", () => {
    const verdict = verdictFor(ADAM, (c) =>
      rewrite(c, leasBinding, { ...withRepo(leasBinding, "adam/kibo-docs"), runner: "u-adam" }),
    );
    expect(verdict).toEqual({ ok: true });
  });

  test("createdBy never changes", () => {
    expect(verdictFor(LEA, (c) => rewrite(c, leasBinding, { createdBy: "u-adam" }))).toEqual(
      refusedAbout("createdBy"),
    );
  });
});

describe("shape of a binding", () => {
  test("a binding must be a plain, valid value under its own id", () => {
    expect(
      verdictFor(LEA, (c) => bindings(c).setContainer("b-new", new LoroMap()).set("runner", "u-adam")),
    ).toEqual(refusedAbout("b-new"));
    expect(verdictFor(LEA, (c) => bindings(c).set("b-new", { id: "b-new", runner: "u-adam" }))).toEqual(
      refusedAbout("b-new"),
    );
    expect(verdictFor(LEA, (c) => bindings(c).set("b-new", { ...leasBinding, id: "b-other" }))).toEqual(
      refusedAbout("b-new"),
    );
  });

  test("removing and recreating a binding under the same id is a rewrite", () => {
    const verdict = verdictFor(LEA, (c) => {
      removeBinding(c, "b-adam");
      addBinding(c, { ...adamsBinding, runner: "u-lea", createdBy: "u-lea" });
    });
    expect(verdict).toEqual(refusedAbout("b-adam"));
  });
});

describe("accepted binding batches", () => {
  test("untouched bindings beside an unrelated edit", () => {
    expect(verdictFor(LEA, (c) => createTicket(c, { title: "Sans rapport" }))).toEqual({ ok: true });
  });

  test("rewriting a binding with its own content", () => {
    expect(verdictFor(LEA, (c) => rewrite(c, adamsBinding, {}))).toEqual({ ok: true });
  });

  test("removing a binding", () => {
    expect(verdictFor(LEA, (c) => removeBinding(c, "b-adam"))).toEqual({ ok: true });
  });
});
