interface PageOf<Item> {
  items: Item[];
}

type Matches<Item> = (item: Item) => boolean;

export function replaceItem<Item, P extends PageOf<Item>>(
  matches: Matches<Item>,
  item: Item,
): (pages: P[]) => P[] {
  return (pages) =>
    pages.map((page) => ({
      ...page,
      items: page.items.map((current) => (matches(current) ? item : current)),
    }));
}

export function removeItem<Item, P extends PageOf<Item>>(
  matches: Matches<Item>,
): (pages: P[]) => P[] {
  return (pages) =>
    pages.map((page) => ({ ...page, items: page.items.filter((item) => !matches(item)) }));
}

// o item novo entra no começo da primeira página ou no fim da última
export function addItem<Item, P extends PageOf<Item>>(
  item: Item,
  where: "first" | "last",
): (pages: P[]) => P[] {
  return (pages) => {
    const index = where === "first" ? 0 : pages.length - 1;
    return pages.map((page, current) => {
      if (current !== index) return page;
      const items = where === "first" ? [item, ...page.items] : [...page.items, item];
      return { ...page, items };
    });
  };
}
