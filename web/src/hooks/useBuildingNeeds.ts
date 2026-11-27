import { listBuildingNeeds, type BuildingNeed } from "../api/interests";
import { usePages } from "./usePages";

function keyOf(need: BuildingNeed): string {
  return need.product.public_id;
}

export function useBuildingNeeds() {
  const pages = usePages(listBuildingNeeds, true as boolean, { keyOf });

  return {
    descending: pages.search,
    sort: pages.changeSearch,
    needs: pages.items,
    // falso enquanto a primeira página da ordem escolhida não chegou
    loaded: pages.lastPage !== undefined,
    loading: pages.loading,
    error: pages.error,
    hasMore: pages.hasMore,
    loadMore: pages.loadMore,
    reload: pages.retry,
  };
}
