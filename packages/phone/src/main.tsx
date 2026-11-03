import "./index.css";
import { followSystemTheme } from "@kibo/ui/theme";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyCspNonce } from "./csp-nonce";
import { indexedDbStorage } from "./idb-storage";
import { browserPasskeys } from "./pairing";
import { browserEnvironment, browserSocket, createPresence } from "./presence";
import { registerServiceWorker } from "./register-sw";
import { createPhoneRuntime } from "./runtime";
import { createServerApi } from "./server-api";

applyCspNonce(document);
followSystemTheme();
registerServiceWorker();

const api = createServerApi({ baseUrl: "" });
const runtime = createPhoneRuntime({
  api,
  storage: indexedDbStorage(),
  data: localStorage,
  passkeys: browserPasskeys,
  presence: (handlers) =>
    createPresence({
      url: api.eventsUrl(),
      openSocket: browserSocket,
      env: browserEnvironment(),
      ...handlers,
    }),
});

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");
createRoot(root).render(
  <StrictMode>
    <App runtime={runtime} />
  </StrictMode>,
);
