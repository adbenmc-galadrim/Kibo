import { expect, mock, test } from "bun:test";
import type { ComponentSummary, Instance, RpcRequest } from "@kibo/schema";
import { render } from "@testing-library/react";

mock.module("../api", () => ({
  client: {
    rpc: (_: RpcRequest) => Promise.resolve([]),
    subscribe: () => () => undefined,
    subscribeTopic: () => () => undefined,
    subscribeEvents: () => () => undefined,
  },
}));

const { PageContext } = await import("./PageContext");
const { createSelectionBus } = await import("./selection-bus");
const { useInstanceApis } = await import("./use-instance-apis");

const components: ComponentSummary[] = [];
const state = { focusedId: null, dispatch: () => undefined, bus: createSelectionBus(), components };
const NO_REF = { current: null };
const seen: unknown[] = [];

function Probe({ instance }: { instance: Instance }) {
  seen.push(useInstanceApis("p1", instance, NO_REF));
  return null;
}

test("the apis of an instance keep their identity across renders of a new snapshot", () => {
  const instance = (): Instance => ({
    id: "i1",
    pageId: "pg",
    component: "kanban@1.0.0",
    layout: { x: 0, y: 0, w: 4, h: 4 },
    config: {},
    componentHash: null,
  });
  const ui = () => (
    <PageContext.Provider value={state}>
      <Probe instance={instance()} />
    </PageContext.Provider>
  );
  const view = render(ui());
  view.rerender(ui());
  view.rerender(ui());
  expect(seen.length).toBeGreaterThan(2);
  expect(new Set(seen).size).toBe(1);
  view.unmount();
});
