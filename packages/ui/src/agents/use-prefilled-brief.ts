import { useState } from "react";

export function usePrefilledBrief(auto: string): [string, (value: string) => void] {
  const [state, setState] = useState({ value: auto, auto });
  let current = state;
  if (state.auto !== auto) {
    current = { value: state.value === "" || state.value === state.auto ? auto : state.value, auto };
    setState(current);
  }
  return [current.value, (value) => setState((s) => ({ ...s, value }))];
}
