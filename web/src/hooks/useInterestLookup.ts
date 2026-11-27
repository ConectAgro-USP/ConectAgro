import { useEffect, useMemo, useState } from "react";
import { listAllMyInterests, type Interest } from "../api/interests";
import { useAuth } from "../auth/AuthContext";

export type InterestLookup = ReadonlyMap<string, Interest>;

function lookupOf(interests: Interest[]): InterestLookup {
  const lookup = new Map<string, Interest>();
  for (const interest of interests) {
    if (interest.product_public_id) lookup.set(interest.product_public_id, interest);
  }
  return lookup;
}

// todas as páginas, para a marca valer em qualquer produto da lista
export function useInterestLookup(): InterestLookup {
  const { profileType, linkStatus } = useAuth();
  const enabled = profileType === "buyer" && linkStatus === "APROVADO";
  const [interests, setInterests] = useState<Interest[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let outdated = false;
    // sem a lista as linhas só ficam sem a marca, e o resto da página segue
    listAllMyInterests()
      .then((all) => {
        if (!outdated) setInterests(all);
      })
      .catch((loadError: unknown) => console.error(loadError));
    return () => {
      outdated = true;
    };
  }, [enabled]);

  return useMemo(() => lookupOf(enabled ? interests : []), [enabled, interests]);
}
