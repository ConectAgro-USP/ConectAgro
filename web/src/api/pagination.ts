export interface Page<Item> {
  items: Item[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// o maior tamanho de página que a API aceita
export const LARGEST_PAGE = 100;
// o maior texto de busca que a API aceita, nos produtos e nos agricultores
export const MAX_SEARCH_TERM = 200;

// para quem precisa da lista inteira, como a consulta por produto
export async function fetchAllPages<Item>(
  loadPage: (page: number) => Promise<Page<Item>>,
): Promise<Item[]> {
  const items: Item[] = [];
  for (let page = 1; ; page++) {
    const result = await loadPage(page);
    items.push(...result.items);
    if (result.page >= result.total_pages) return items;
  }
}

export function pageQuery(page: number, pageSize?: number): URLSearchParams {
  const query = new URLSearchParams({ page: String(page) });
  if (pageSize !== undefined) query.set("page_size", String(pageSize));
  return query;
}
