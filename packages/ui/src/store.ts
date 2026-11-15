// A state a flow keeps, that anything can watch. `getState` and `subscribe` are exactly what React's
// useSyncExternalStore wants, and just as easy to wire to Vue, Svelte, Solid, Angular or a plain page.

export interface Watchable<S> {
  getState(): S;
  /** Calls `listener` after every change. Returns a function that stops. */
  subscribe(listener: () => void): () => void;
}

export function createStore<S>(initial: S) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState(change: Partial<S> | ((state: S) => Partial<S>)) {
      state = { ...state, ...(typeof change === "function" ? change(state) : change) };
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
