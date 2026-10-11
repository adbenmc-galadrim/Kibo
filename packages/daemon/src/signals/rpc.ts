import {
  type Actor,
  isSignalRequest,
  KiboError,
  SIGNAL_RPC,
  type Signal,
  type SignalsView,
} from "@kibo/schema";
import { type RpcExtension, requireLocal } from "../rpc-extensions";

export type SignalRpcService = {
  list(projectId: string): SignalsView;
  ignore(projectId: string, signalId: string, by: Actor): Signal;
};

export type SignalRpcData = {
  assertWritable(projectId: string): void;
  viewer(projectId: string): string;
};

const METHODS = SIGNAL_RPC.map((schema) => schema.shape.method.value);

export function signalRpc(service: SignalRpcService, data: SignalRpcData, emit: () => void): RpcExtension {
  return {
    methods: METHODS,
    async handle(req, ctx) {
      requireLocal(ctx);
      if (!isSignalRequest(req)) throw new KiboError("INTERNAL", `${req.method} is not a signal method`);
      data.assertWritable(req.projectId);
      switch (req.method) {
        case "listSignals":
          return service.list(req.projectId);
        case "ignoreSignal": {
          const by: Actor = { kind: "human", ref: data.viewer(req.projectId) };
          const ignored = service.ignore(req.projectId, req.signalId, by);
          emit();
          return ignored;
        }
      }
    },
  };
}
