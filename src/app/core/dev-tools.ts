import { effect, Signal } from '@angular/core';

interface RegisteredSignal { name: string; signal: Signal<unknown> };

const registeredSignals: RegisteredSignal[] = [];

function buildRootState() {
  const root: Record<string, unknown> = {};
  for (const entry of registeredSignals) {
    root[entry.name] = entry.signal();
  }
  return root;
}

export function createStoreLogger() {
  let lastRootStateStr = '';

  return {
    attachState<T>(signal: Signal<T>, options?: { name?: string }) {
      const name = options?.name ?? `signal_${registeredSignals.length}`;

      if (registeredSignals.some((s) => s.signal === signal)) return;

      registeredSignals.push({ name, signal });

      // initialer Log
      const initialState = buildRootState();
      lastRootStateStr = JSON.stringify(initialState);
      console.log(`${name}/INIT`, initialState);

      effect(() => {
        const rootState = buildRootState();
        const rootStateStr = JSON.stringify(rootState);

        if (rootStateStr !== lastRootStateStr) {
          lastRootStateStr = rootStateStr;
          console.log(`STORE_UPDATE`, rootState);
        }
      });
    },
  };
}

export const storeLogger = createStoreLogger();
