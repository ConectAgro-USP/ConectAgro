import { useCallback, useEffect, useState } from "react";
import {
  createProduct as sendCreateProduct,
  deleteProduct as sendDeleteProduct,
  listMyProducts,
  updateProduct as sendUpdateProduct,
  type Product,
  type ProductInput,
} from "../api/products";
import { errorMessage, lostAccess } from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface UseProductsState {
  data: Product[];
  loading: boolean;
  error: string;
  retry: () => void;
  create: (product: ProductInput) => Promise<Product>;
  update: (publicId: string, changes: ProductInput) => Promise<Product>;
  remove: (publicId: string) => Promise<void>;
}

export function useProducts(): UseProductsState {
  const { refreshUser } = useAuth();
  const [data, setData] = useState<Product[]>([]);
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
      setLoading(true);
      setError("");
      try {
        const products = await listMyProducts();
        if (!outdated) setData(products);
      } catch (loadError) {
        if (outdated) return;
        setError(errorMessage(loadError));
        if (lostAccess(loadError)) {
          await refreshUser();
        }
      } finally {
        if (!outdated) setLoading(false);
      }
    }

    load().catch((refreshError: unknown) => console.error(refreshError));
    return () => {
      outdated = true;
    };
  }, [refreshUser, reloadKey]);

  async function create(product: ProductInput): Promise<Product> {
    const saved = await sendCreateProduct(product);
    setData((current) => [saved, ...current]);
    return saved;
  }

  async function update(publicId: string, changes: ProductInput): Promise<Product> {
    const saved = await sendUpdateProduct(publicId, changes);
    setData((current) => current.map((product) => (product.public_id === publicId ? saved : product)));
    return saved;
  }

  async function remove(publicId: string): Promise<void> {
    await sendDeleteProduct(publicId);
    setData((current) => current.filter((product) => product.public_id !== publicId));
  }

  return { data, loading, error, retry, create, update, remove };
}
