import { afterEach, expect, test } from "bun:test";
import {
  assign,
  briefOf,
  finished,
  release,
  startBoutique,
  until,
  wrote,
} from "./overlaps/integration.test-helper";
import { stopDaemons } from "./project-agent/integration.test-helper";
import { cleanupTmp, commit, git } from "./testing/git-test-kit";

afterEach(async () => {
  await stopDaemons();
  cleanupTmp();
});

test("a resumed run keeps the files its ticket already committed in the work shown to others", async () => {
  const b = await startBoutique();
  const { rpc } = b.stack;
  const first = await assign(b, "BOU-12");
  await wrote(b.stack, first, 2);
  release(b.stack, first);
  const ended = await finished(rpc, first.id);
  const cwd = ended.cwd ?? "";
  await git(["add", "."], cwd);
  await git([...commit, "-m", "premier run"], cwd);

  const resumed = await assign(b, "BOU-12");
  await wrote(b.stack, resumed, 2);
  const other = await assign(b, "BOU-15");
  await until(async () =>
    briefOf(b.stack, other).includes("## Travail en cours sur le projet") ? true : undefined,
  );
  const brief = briefOf(b.stack, other);
  expect(brief).toContain(`### ${resumed.label}`);
  expect(brief).toContain("src/lib/format.ts");
  expect(brief).toContain("formatDate");
  await finished(rpc, other.id);
  release(b.stack, resumed);
  await finished(rpc, resumed.id);
}, 90_000);
