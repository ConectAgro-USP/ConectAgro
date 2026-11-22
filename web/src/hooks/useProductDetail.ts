import { useCallback, useEffect, useState } from "react";
import { errorMessage, lostAccess } from "../api/client";
import { getProduct, type ProductDetail } from "../api/products";
import { useAuth } from "../auth/AuthContext";

export function useProductDetail(publicId: string | undefined) {
  const { refreshUser } = useAuth();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setError("");
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let outdated = false;

    async function load() {
      if (!publicId) {
        setLoading(false);
        setError("Produto não encontrado");
        return;
      }

      setLoading(true);
      setError("");
      try {
        const data = await getProduct(publicId);
        
        if (!outdated) 
          setProduct(data);
      } catch (err) {
        if (outdated) 
          return;

        setError(errorMessage(err));
        
        if (lostAccess(err)) 
          await refreshUser();
      } finally {
        if (!outdated) 
          setLoading(false);
      }
    }

    load().catch((err: unknown) => console.error(err));

    return () => {
      outdated = true;
    };
  }, [publicId, refreshUser, reloadKey]);

  return { product, loading, error, retry };
}
