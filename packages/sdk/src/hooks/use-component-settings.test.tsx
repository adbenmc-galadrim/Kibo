import { expect, test } from "bun:test";
import { type ComponentManifestInput, DEFAULT_COMPONENT_SETTINGS } from "@kibo/schema";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMockSdk } from "../mock";
import { SdkProvider } from "../react";
import type { KiboSdk } from "../types";
import { useComponentSettings } from "./use-component-settings";

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

test("a host that answers nothing leaves the default settings", async () => {
  const { sdk } = createMockSdk(manifest);
  const answer = Promise.resolve(JSON.parse("null"));
  const silent: KiboSdk = { ...sdk, settings: { ...sdk.settings, get: () => answer } };
  const { result } = renderHook(() => useComponentSettings(), { wrapper: wrap(silent) });
  await act(async () => {
    await answer;
  });
  expect(result.current).toEqual(DEFAULT_COMPONENT_SETTINGS);
});
