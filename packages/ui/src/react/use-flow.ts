import { useEffect, useSyncExternalStore } from "react";
import type { Watchable } from "../store.js";

/** A flow's state, re-rendering when it changes. */
export function useFlow<S>(flow: Watchable<S>): S {
  return useSyncExternalStore(flow.subscribe, flow.getState, flow.getState);
}

/** Closes on Escape while `active`. */
export function useEscape(active: boolean, close: () => void) {
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [active, close]);
}
