import { expect, test } from "bun:test";
import type { ComponentManifestInput } from "@kibo/schema";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMockSdk } from "../mock";
import { SdkProvider } from "../react";
import type { KiboSdk } from "../types";
import { useProject } from "./use-project";

const manifest: ComponentManifestInput = {
  id: "probe",
  version: "1.0.0",
  kind: "view",
  title: "Probe",
  reads: ["ticket"],
  writes: [],
};

const wrap = (sdk: KiboSdk) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <SdkProvider sdk={sdk}>{children}</SdkProvider>;
  };

test("the project is unknown until the host answers, then carries the host's day", async () => {
  const { sdk } = createMockSdk(manifest, { today: "2026-10-16" });
  const { result } = renderHook(() => useProject(), { wrapper: wrap(sdk) });
  expect(result.current).toBeNull();
  await waitFor(() => expect(result.current?.today).toBe("2026-10-16"));
});
