import { KiboError, REMOTE_RPC_METHODS, type RemotePairing, type RemoteStatus } from "@kibo/schema";
import { type RpcExtension, requireLocal } from "../rpc-extensions";

export type RemoteController = {
  status(): Promise<RemoteStatus>;
  enable(input: { serverUrl: string; setupCode: string }): Promise<RemoteStatus>;
  disable(): Promise<RemoteStatus>;
  setProjects(projectIds: readonly string[]): Promise<RemoteStatus>;
  createPairing(): Promise<RemotePairing>;
  revokePhone(): Promise<RemoteStatus>;
};

export function remoteRpc(controller: RemoteController): RpcExtension {
  return {
    methods: REMOTE_RPC_METHODS,
    handle: async (req, ctx) => {
      requireLocal(ctx);
      switch (req.method) {
        case "remote.status":
          return controller.status();
        case "remote.enable":
          return controller.enable({ serverUrl: req.serverUrl, setupCode: req.setupCode });
        case "remote.disable":
          return controller.disable();
        case "remote.setProjects":
          return controller.setProjects(req.projectIds);
        case "remote.createPairing":
          return controller.createPairing();
        case "remote.revokePhone":
          return controller.revokePhone();
        default:
          throw new KiboError("INTERNAL", `remote rpc cannot handle ${req.method}`);
      }
    },
  };
}
