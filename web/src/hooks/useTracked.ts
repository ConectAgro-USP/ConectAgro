import { useState } from "react";

// o valor da última página que chegou e o que segue as escritas feitas depois
interface Tracked<T> {
  from: object;
  value: T;
}

type Adjust<T> = (change: (value: T) => T) => void;

// cada página que chega traz o valor da API, mesmo igual ao que veio antes
export function useTracked<T>(
  received: object | null,
  latest: T | undefined,
): [T | null, Adjust<T>] {
  const [tracked, setTracked] = useState<Tracked<T> | null>(null);
  if (received !== null && latest !== undefined && received !== tracked?.from) {
    setTracked({ from: received, value: latest });
  }

  function adjust(change: (value: T) => T) {
    setTracked((current) => current && { ...current, value: change(current.value) });
  }

  return [tracked?.value ?? null, adjust];
}
