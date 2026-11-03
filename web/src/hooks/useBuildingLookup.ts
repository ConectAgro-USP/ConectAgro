import { useEffect, useState } from "react";
import { ApiError, errorMessage } from "../api/client";

export interface BuildingLookup<Found> {
  cnpj: string;
  changeCnpj: (cnpj: string) => void;
  found: Found | null;
  searching: boolean;
  error: string;
  requireFound: () => Found | null;
}

// desde julho de 2026 o CNPJ pode ter letras
function isComplete(cnpj: string): boolean {
  return cnpj.replace(/[^0-9A-Za-z]/g, "").length === 14;
}

// um 422 é CNPJ inválido, inexistente ou inativo; repetir não muda nada
function canRetry(lookupError: unknown): boolean {
  return !(lookupError instanceof ApiError && lookupError.status === 422);
}

export function useBuildingLookup<Found>(
  find: (cnpj: string) => Promise<Found>,
  initialCnpj = "",
): BuildingLookup<Found> {
  const [cnpj, setCnpj] = useState(initialCnpj);
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [retryable, setRetryable] = useState(false);
  const searching = isComplete(cnpj) && found === null && error === "";

  function changeCnpj(value: string) {
    setCnpj(value);
    setFound(null);
    setError("");
  }

  function requireFound(): Found | null {
    if (found !== null) {
      return found;
    }
    if (searching) {
      return null;
    }
    if (!isComplete(cnpj)) {
      setError("Confira o CNPJ do prédio");
    } else if (retryable) {
      setError("");
      setAttempt(attempt + 1);
    }
    return null;
  }

  useEffect(() => {
    if (!isComplete(cnpj)) {
      return;
    }
    let outdated = false;
    find(cnpj)
      .then((result) => {
        if (!outdated) setFound(result);
      })
      .catch((lookupError: unknown) => {
        if (outdated) return;
        setRetryable(canRetry(lookupError));
        setError(errorMessage(lookupError));
      });
    return () => {
      outdated = true;
    };
  }, [cnpj, find, attempt]);

  return { cnpj, changeCnpj, found, searching, error, requireFound };
}
