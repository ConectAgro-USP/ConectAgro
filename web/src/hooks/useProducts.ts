import { useCallback, useEffect, useState } from "react";
import {
  createProduct as sendCreateProduct,
  deleteProduct as sendDeleteProduct,
  listMyProducts,
  updateProduct as sendUpdateProduct,
  uploadProductPicture,
  type MyProduct,
  type ProductInput,
} from "../api/products";
import { errorMessage, lostAccess } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useWriteGuard } from "./useWriteGuard";

interface UseProductsState {
  data: MyProduct[];
  loading: boolean;
  error: string;
  retry: () => void;
  create: (product: ProductInput) => Promise<MyProduct>;
  update: (publicId: string, changes: ProductInput) => Promise<MyProduct>;
  remove: (publicId: string) => Promise<void>;
  setAvailable: (publicId: string, available: boolean) => Promise<void>;
  uploadPicture: (publicId: string, picture: Blob) => Promise<void>;
}

export function useProducts(): UseProductsState {
  const { refreshUser } = useAuth();
  const guard = useWriteGuard();
  const [data, setData] = useState<MyProduct[]>([]);
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

  async function create(product: ProductInput): Promise<MyProduct> {
    const saved = await guard(sendCreateProduct(product));
    setData((current) => [...current, saved]);
    return saved;
  }

  function replace(saved: MyProduct) {
    setData((current) =>
      current.map((product) => (product.public_id === saved.public_id ? saved : product)),
    );
  }

  async function update(publicId: string, changes: ProductInput): Promise<MyProduct> {
    const saved = await guard(sendUpdateProduct(publicId, changes));
    replace(saved);
    return saved;
  }

  async function setAvailable(publicId: string, available: boolean): Promise<void> {
    replace(await guard(sendUpdateProduct(publicId, { is_available: available })));
  }

  async function uploadPicture(publicId: string, picture: Blob): Promise<void> {
    replace(await guard(uploadProductPicture(publicId, picture)));
  }

  async function remove(publicId: string): Promise<void> {
    await guard(sendDeleteProduct(publicId));
    setData((current) => current.filter((product) => product.public_id !== publicId));
  }

  return { data, loading, error, retry, create, update, remove, setAvailable, uploadPicture };
}
