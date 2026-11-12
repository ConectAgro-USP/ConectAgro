// as datas seguem o horário de Brasília, igual aos filtros da API
const BUSINESS_TZ = "America/Sao_Paulo";
const MONEY = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DAY = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: BUSINESS_TZ,
});
const MONTH = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: BUSINESS_TZ,
});
const NAMES = new Intl.ListFormat("pt-BR", { type: "conjunction" });

export function formatMoney(value: string): string {
  return MONEY.format(Number(value));
}

export function formatDay(moment: string): string {
  return DAY.format(new Date(moment));
}

export function formatNames(names: string[]): string {
  return NAMES.format(names);
}

// a lista já vem da mais nova para a mais antiga, então os meses saem em ordem
export function groupByMonth<Item>(
  items: Item[],
  dateOf: (item: Item) => string,
): [string, Item[]][] {
  const months = new Map<string, Item[]>();
  for (const item of items) {
    const month = MONTH.format(new Date(dateOf(item)));
    const sameMonth = months.get(month) ?? [];
    sameMonth.push(item);
    months.set(month, sameMonth);
  }
  return [...months];
}
