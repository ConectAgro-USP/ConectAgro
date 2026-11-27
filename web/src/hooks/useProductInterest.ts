import { ApiError } from "../api/client";
import {
  createInterest,
  deleteInterest,
  findMyInterest,
  updateInterest,
  type Interest,
} from "../api/interests";
import type { ProductUnit } from "../api/products";
import { useLoaded } from "./useLoaded";
import { useWriteGuard } from "./useWriteGuard";

export function useProductInterest(productPublicId: string) {
  const guard = useWriteGuard();
  // o interesse do morador num produto, pedido à parte da lista inteira
  const found = useLoaded(findMyInterest, productPublicId);

  // outra aba ou a compra mudou o interesse, então ele é relido
  async function rereadOnConflict(write: Promise<Interest>): Promise<void> {
    try {
      found.setData(await guard(write));
    } catch (writeError) {
      if (writeError instanceof ApiError && writeError.status === 409) found.retry();
      throw writeError;
    }
  }

  // a unidade é a mostrada na página, e a API recusa se ela mudou
  function register(quantity: number, unit: ProductUnit): Promise<void> {
    const interest = { product_public_id: productPublicId, quantity, unit };
    return rereadOnConflict(createInterest(interest));
  }

  function update(publicId: string, quantity: number, unit: ProductUnit): Promise<void> {
    return rereadOnConflict(updateInterest(publicId, quantity, unit));
  }

  async function remove(publicId: string): Promise<void> {
    await guard(deleteInterest(publicId));
    found.setData(null);
  }

  return {
    interest: found.data,
    loading: found.loading,
    error: found.error,
    retry: found.retry,
    register,
    update,
    remove,
  };
}
