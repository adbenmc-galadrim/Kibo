import { expect, test } from "bun:test";
import { RpcRequest } from "@kibo/schema";
import { rpcRefusal } from "./rpc-refusal";

const refusalOf = (raw: unknown): string => {
  const parsed = RpcRequest.safeParse(raw);
  if (parsed.success) throw new Error("expected an invalid request");
  return rpcRefusal(parsed.error);
};

test("an invalid request is refused with a short, stable message naming its fields", () => {
  expect(refusalOf({ method: "reviewComponentDraft", draftId: "x", version: "bad" })).toBe(
    "invalid request: draftId, version, changes",
  );
  expect(refusalOf({ method: "startComponentDraft", draft: { mode: "create" } })).toBe(
    "invalid request: draft.id, draft.title, draft.kind, draft.withServer, draft.description",
  );
  expect(refusalOf({ method: "nope" })).toBe("invalid request: method");
  expect(refusalOf(null)).toBe("invalid request");
});

test("at most five fields are named", () => {
  const message = refusalOf({ method: "createProject" });
  expect(message.startsWith("invalid request: ")).toBe(true);
  expect(message.split(", ").length).toBeLessThanOrEqual(5);
  expect(message).not.toContain("Required");
});
