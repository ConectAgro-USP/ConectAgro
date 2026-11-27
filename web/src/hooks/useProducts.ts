import {
  createProduct as sendCreateProduct,
  deleteProduct as sendDeleteProduct,
  listMyProducts,
  updateProduct as sendUpdateProduct,
  uploadProductPicture,
  type MyProduct,
  type ProductInput,
} from "../api/products";
import {
  availabilityOf,
  inTab,
  recount,
  type ProductTab,
} from "../components/products/productState";
import { addItem, removeItem, replaceItem } from "./pageEdits";
import { usePages } from "./usePages";
import { useTracked } from "./useTracked";
import { useWriteGuard } from "./useWriteGuard";

function loadMyProducts(tab: ProductTab, page: number) {
  return listMyProducts(availabilityOf(tab), page);
}

function keyOf(product: MyProduct): string {
  return product.public_id;
}

export function useProducts() {
  const guard = useWriteGuard();
  const pages = usePages(loadMyProducts, "all" as ProductTab, { keyOf });
  const [counts, adjustCounts] = useTracked(pages.received, pages.lastPage?.counts);

  function track(before: MyProduct | null, after: MyProduct | null) {
    adjustCounts((current) => recount(current, before, after));
  }

  const same = (publicId: string) => (product: MyProduct) => product.public_id === publicId;

  async function create(product: ProductInput): Promise<MyProduct> {
    const saved = await guard(sendCreateProduct(product));
    // a lista vem da mais antiga para a mais nova
    pages.editPages(addItem(saved, "last"));
    track(null, saved);
    return saved;
  }

  // quem chama passa o produto como estava, para a contagem descontar
  function replace(before: MyProduct, saved: MyProduct) {
    // fica nas páginas e conta como tirado da lista, a tela o esconde pela aba
    const left = inTab(pages.search, before) && !inTab(pages.search, saved);
    pages.editPages(replaceItem(same(saved.public_id), saved), { dropped: left ? 1 : 0 });
    track(before, saved);
  }

  async function update(before: MyProduct, changes: Partial<ProductInput>): Promise<MyProduct> {
    const saved = await guard(sendUpdateProduct(before.public_id, changes));
    replace(before, saved);
    return saved;
  }

  async function setAvailable(before: MyProduct, available: boolean): Promise<void> {
    const changes = { is_available: available };
    replace(before, await guard(sendUpdateProduct(before.public_id, changes)));
  }

  async function uploadPicture(publicId: string, picture: Blob): Promise<void> {
    // a foto não muda a situação do produto, então a contagem fica igual
    const saved = await guard(uploadProductPicture(publicId, picture));
    pages.editPages(replaceItem(same(publicId), saved));
  }

  async function remove(before: MyProduct): Promise<void> {
    await guard(sendDeleteProduct(before.public_id));
    pages.editPages(removeItem(same(before.public_id)), { dropped: 1 });
    track(before, null);
  }

  return {
    items: pages.items,
    counts,
    tab: pages.search,
    changeTab: pages.changeSearch,
    loading: pages.loading,
    error: pages.error,
    hasMore: pages.hasMore,
    loadMore: pages.loadMore,
    retry: pages.retry,
    create,
    update,
    remove,
    setAvailable,
    uploadPicture,
  };
}
