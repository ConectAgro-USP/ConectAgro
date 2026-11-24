import { useEffect, useState } from "react";
import { ApiError, errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export interface BuildingLookup<Found> {
  query: string;
  changeQuery: (query: string) => void;
  found: Found | null;
  searching: boolean;
  error: string;
  requireFound: () => Found | null;
}

export interface LookupRule {
  isComplete: (query: string) => boolean;
  incomplete: string;
  // espera a pessoa parar de digitar antes de buscar
  delayMs: number;
}

export const CNPJ_RULE: LookupRule = {
  // desde julho de 2026 o CNPJ pode ter letras
  isComplete: (cnpj) => cnpj.replace(/[^0-9A-Za-z]/g, "").length === 14,
  incomplete: "Confira o CNPJ do prédio",
  delayMs: 0,
};

export const NAME_RULE: LookupRule = {
  // o servidor conta letras e números, sem acentos
  isComplete: (name) => name.replace(/[^\p{L}\p{N}]/gu, "").length >= 3,
  incomplete: "Informe ao menos 3 letras do nome do prédio",
  delayMs: 400,
};

// um 422 é CNPJ recusado ou nome curto, repetir não muda nada
function canRetry(lookupError: unknown): boolean {
  return !(lookupError instanceof ApiError && lookupError.status === 422);
}

function isSessionEnded(lookupError: unknown): boolean {
  return lookupError instanceof ApiError && lookupError.status === 401;
}

export function useBuildingLookup<Found>(
  find: (query: string) => Promise<Found>,
  initialQuery = "",
  rule: LookupRule = CNPJ_RULE,
): BuildingLookup<Found> {
  const { refreshUser } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [retryable, setRetryable] = useState(false);
  const { isComplete, delayMs } = rule;
  const searching = isComplete(query) && found === null && error === "";

  function changeQuery(value: string) {
    setQuery(value);
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
    if (!isComplete(query)) {
      setError(rule.incomplete);
    } else if (retryable) {
      setError("");
      setAttempt(attempt + 1);
    }
    return null;
  }

  useEffect(() => {
    if (!isComplete(query)) {
      return;
    }
    let outdated = false;

    async function search() {
      try {
        const result = await find(query);
        if (!outdated) setFound(result);
      } catch (lookupError) {
        if (outdated) return;
        setRetryable(canRetry(lookupError));
        setError(errorMessage(lookupError));
        if (isSessionEnded(lookupError)) {
          // sem sessão, recarregar o usuário leva quem preenche de volta ao login
          await refreshUser();
        }
      }
    }

    function start() {
      search().catch((refreshError: unknown) => console.error(refreshError));
    }

    const timer = delayMs > 0 ? setTimeout(start, delayMs) : undefined;
    if (timer === undefined) start();
    return () => {
      outdated = true;
      clearTimeout(timer);
    };
  }, [query, find, attempt, refreshUser, isComplete, delayMs]);

  return { query, changeQuery, found, searching, error, requireFound };
}
