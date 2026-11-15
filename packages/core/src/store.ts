// Where the server keeps the little it must: screenshots (an issue links to one), when each was taken
// (so the oldest can go), and which `ref` each issue came from (for whoever runs the server).
//
// Bring your own by passing `store` to `createRelay`. `patch` merges `fields` into the record at `key`,
// and a field set to null is removed. That is how a sync log or a document store already behaves.

export type Fields = Record<string, unknown>;

export interface RelayStore {
  read(key: string): Promise<Fields | undefined>;
  patch(key: string, fields: Fields): Promise<void>;
}

/** Kept in memory: fine for development and tests; screenshots and issue refs are gone on restart. */
export function memoryStore(): RelayStore {
  const records = new Map<string, Fields>();
  return {
    async read(key) {
      const found = records.get(key);
      return found ? { ...found } : undefined;
    },
    async patch(key, fields) {
      const next = { ...(records.get(key) ?? {}) };
      for (const [name, value] of Object.entries(fields)) {
        if (value === null) delete next[name];
        else next[name] = value;
      }
      records.set(key, next);
    },
  };
}
