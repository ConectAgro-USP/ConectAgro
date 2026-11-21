// as datas seguem o horário de Brasília, igual aos filtros da API
const BUSINESS_TZ = "America/Sao_Paulo";
const MONEY = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DAY = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: BUSINESS_TZ,
});
const FULL_DAY = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: BUSINESS_TZ,
});
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: BUSINESS_TZ,
});
const NAMES = new Intl.ListFormat("pt-BR", { type: "conjunction" });
const DISTANCE = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const RATING = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const PERCENT = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export function formatMoney(value: string): string {
  return MONEY.format(Number(value));
}

export function formatDay(moment: string): string {
  return DAY.format(new Date(moment));
}


export function formatFullDay(moment: string): string {
  return FULL_DAY.format(new Date(moment));
}

// a entrega prevista chega só com o dia, sem horário para converter
export function formatDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

// com o ano, para a data não ficar ambígua quando cai em outro ano
export function formatFullDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export function daysUntil(date: string): number {
  const [day, month, year] = FULL_DAY.format(new Date()).split("/");
  return (Date.parse(date) - Date.parse(`${year}-${month}-${day}`)) / DAY_MS;
}

export function formatStars(rating: number): string {
  return rating === 1 ? "1 estrela" : `${rating} estrelas`;
}

export function formatNames(names: string[]): string {
  return NAMES.format(names);
}

export function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatDistance(kilometers: number): string {
  return `${DISTANCE.format(kilometers)} km`;
}

export function formatRating(rating: number): string {
  return RATING.format(rating);
}

// a API manda a porcentagem de 0 a 100, e o Intl espera de 0 a 1
export function formatPercent(percentage: number): string {
  return PERCENT.format(percentage / 100);
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
