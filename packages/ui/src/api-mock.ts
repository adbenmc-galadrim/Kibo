import type * as api from "./api";

type ApiModule = typeof api;
type ApiMock = Omit<Partial<ApiModule>, "client"> & { client: object };

const unsubscribe = () => () => {};

export const apiMock = (overrides: ApiMock) => ({
  onUnauthorized: unsubscribe,
  onWrite: unsubscribe,
  ...overrides,
});
