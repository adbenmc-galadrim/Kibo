import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import { apiMock } from "../api-mock";

type Call = { method: string };
let answer: (call: Call) => Promise<unknown> = () => Promise.resolve(null);
mock.module("../api", () => apiMock({ client: { rpc: (call: Call) => answer(call) } }));
const { useHoldSuggestions } = await import("./hold-suggestions");

const own = (reason: string) => ({ onHold: { source: "own", key: "SILO-1", reason, since: "2026-10-16" } });
const held = (reason: string) => ({ kind: "held", data: { reason } });

afterEach(() => {
  answer = () => Promise.resolve(null);
});

test("current reasons come first by frequency, then the journal's, without duplicates", async () => {
  answer = (call) =>
    Promise.resolve(
      call.method === "getProject"
        ? {
            tickets: [
              own("Serveur MinIO de recette indisponible"),
              own("Règle de fusion à valider par le client"),
              own("Serveur MinIO de recette indisponible"),
              { onHold: { source: "dependency", key: "SILO-33", reason: "Ignorée", since: "2026-10-16" } },
              { onHold: null },
            ],
          }
        : {
            items: [
              held("Accès à la base contrats"),
              { kind: "resumed", data: { reason: "Levée" } },
              held("Règle de fusion à valider par le client"),
            ],
          },
    );
  const { result } = renderHook(() => useHoldSuggestions("p1"));
  await waitFor(() =>
    expect(result.current).toEqual([
      "Serveur MinIO de recette indisponible",
      "Règle de fusion à valider par le client",
      "Accès à la base contrats",
    ]),
  );
});

test("a failed read is logged and leaves no suggestion", async () => {
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  const failure = new Error("boom");
  answer = () => Promise.reject(failure);
  const { result } = renderHook(() => useHoldSuggestions("p1"));
  await waitFor(() => expect(warn).toHaveBeenCalledWith("[kibo] hold reasons unavailable", failure));
  expect(result.current).toEqual([]);
  warn.mockRestore();
});
