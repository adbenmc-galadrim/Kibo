import { useSyncExternalStore } from "react";

function subscribe(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

const isOnline = (): boolean => navigator.onLine;
const assumeOnline = (): boolean => true;

export const useOnline = (): boolean => useSyncExternalStore(subscribe, isOnline, assumeOnline);
