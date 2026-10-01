import { KiboError } from "@kibo/schema";
import { DEMO_NOTE_AGES, DEMO_NOTES, seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk, type MockSdk } from "@kibo/sdk/mock";
import { DEMO_VIEWER, type PreviewPort, type PreviewReply, parsePreviewRequest } from "./preview-protocol";

function failure(id: number, e: unknown): PreviewReply {
  if (e instanceof KiboError) return { type: "error", id, code: e.code, message: e.detail };
  console.error("[kibo-ui] draft preview call failed", e);
  return { type: "error", id, code: "INTERNAL", message: "internal error" };
}

export function servePreviewBackend(port: PreviewPort): () => void {
  let mock: MockSdk | null = null;
  let unsubscribe = () => {};
  const send = (reply: PreviewReply) => port.postMessage(reply);
  const onMessage = (e: MessageEvent) => {
    const request = parsePreviewRequest(e.data);
    if (!request) {
      console.warn("[kibo-ui] invalid draft preview request ignored");
      return;
    }
    if (request.type === "init") {
      unsubscribe();
      mock = createMockSdk(request.manifest, {
        seed: (run) => void seedDemo(run, DEMO_VIEWER),
        viewer: DEMO_VIEWER,
        notes: DEMO_NOTES,
        noteAges: DEMO_NOTE_AGES,
      });
      unsubscribe = mock.backend.subscribe(() => send({ type: "changed" }));
      return;
    }
    const { id, call } = request;
    if (!mock) {
      send({ type: "error", id, code: "INVALID_INPUT", message: "preview not initialised" });
      return;
    }
    mock.backend.call(call).then(
      (result) => send({ type: "result", id, result: result ?? null }),
      (err: unknown) => send(failure(id, err)),
    );
  };
  port.addEventListener("message", onMessage);
  return () => {
    port.removeEventListener("message", onMessage);
    unsubscribe();
  };
}
