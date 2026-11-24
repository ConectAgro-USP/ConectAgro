import { useState } from "react";

// o campo edita uma cópia, que volta ao valor de fora quando ele muda
export function useSyncedValue(source: string): [string, (value: string) => void] {
  const [value, setValue] = useState(source);
  const [seen, setSeen] = useState(source);
  if (seen !== source) {
    setSeen(source);
    setValue(source);
  }
  return [value, setValue];
}
