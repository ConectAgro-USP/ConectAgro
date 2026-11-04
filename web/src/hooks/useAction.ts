import { useState } from "react";
import { errorMessage } from "../api/client";

export function useAction() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function run(action: () => Promise<void>) {
    setError("");
    setPending(true);
    action()
      .catch((actionError: unknown) => setError(errorMessage(actionError)))
      .finally(() => setPending(false));
  }

  return { error, setError, pending, run };
}
