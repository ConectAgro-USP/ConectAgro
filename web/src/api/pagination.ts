export interface Page<Item> {
  items: Item[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
