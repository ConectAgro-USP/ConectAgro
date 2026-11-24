import { useMemo } from "react";
import type { Interest } from "../api/interests";
import { useAuth } from "../auth/AuthContext";
import { useMyInterests } from "./useMyInterests";

export type InterestLookup = ReadonlyMap<string, Interest>;

function lookupOf(interests: Interest[]): InterestLookup {
  const lookup = new Map<string, Interest>();
  for (const interest of interests) {
    if (interest.product_public_id) lookup.set(interest.product_public_id, interest);
  }
  return lookup;
}

// uma leitura por página, e cada linha consulta o produto dela
export function useInterestLookup(): InterestLookup {
  const { profileType, linkStatus } = useAuth();
  const { data } = useMyInterests(profileType === "buyer" && linkStatus === "APROVADO");
  return useMemo(() => lookupOf(data), [data]);
}
