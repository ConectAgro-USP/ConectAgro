import type { PurchaseStatus } from "./api/history";
import type { ProductUnit } from "./api/products";

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

// o mesmo estado da API, visto por quem entrega e por quem recebe
export const FARMER_STATUS_LABELS: Record<PurchaseStatus, string> = {
  "EM PROGRESSO": "A entregar",
  ENTREGUE: "Entregue",
  CANCELADA: "Cancelada",
};
export const MANAGER_STATUS_LABELS: Record<PurchaseStatus, string> = {
  ...FARMER_STATUS_LABELS,
  "EM PROGRESSO": "A caminho",
};

export function formatMoney(value: string | number): string {
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

export function formatNames(names: string[]): string {
  return NAMES.format(names);
}

// quem entrou sem o nome do Google fica sem nome curto na API
export function farmerName(item: { farmer_short_name: string }): string {
  return item.farmer_short_name || "Agricultor";
}

export function sellerName(farmer: { short_name: string; farm_name: string | null }): string {
  const names = [farmer.short_name, farmer.farm_name].filter(Boolean);
  return names.join(", ") || "Agricultor";
}

export function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

interface UnitWords {
  one: string;
  many: string;
  name: string;
}

const UNITS: Record<ProductUnit, UnitWords> = {
  kg: { one: "kg", many: "kg", name: "quilo" },
  unidade: { one: "unidade", many: "unidades", name: "unidade" },
  duzia: { one: "dúzia", many: "dúzias", name: "dúzia" },
  maco: { one: "maço", many: "maços", name: "maço" },
  litro: { one: "litro", many: "litros", name: "litro" },
};

type MaybeUnit = string | null | undefined;

// sem a unidade, como no interesse de produto apagado, vale o quilo
function wordsOf(unit: MaybeUnit): UnitWords {
  return unit && Object.hasOwn(UNITS, unit) ? UNITS[unit as ProductUnit] : UNITS.kg;
}

export function unitWord(count: number, unit: MaybeUnit): string {
  const words = wordsOf(unit);
  return count === 1 ? words.one : words.many;
}

export function unitPlural(unit: MaybeUnit): string {
  return wordsOf(unit).many;
}

export function formatQuantity(count: number, unit: MaybeUnit): string {
  return `${count} ${unitWord(count, unit)}`;
}

export function formatStock(count: number, unit: MaybeUnit): string {
  return `${formatQuantity(count, unit)} ${count === 1 ? "disponível" : "disponíveis"}`;
}

export function isProductUnit(value: unknown): value is ProductUnit {
  return typeof value === "string" && Object.hasOwn(UNITS, value);
}

export function unitName(unit: MaybeUnit): string {
  return wordsOf(unit).name;
}

export function pricePer(unit: MaybeUnit): string {
  return `por ${wordsOf(unit).name}`;
}

export function formatUnitPrice(price: string | number, unit: MaybeUnit): string {
  return `${formatMoney(price)} ${pricePer(unit)}`;
}

export function priceLabel(unit: MaybeUnit): string {
  return `Preço ${pricePer(unit)} (R$)`;
}

export function quantityLabel(unit: MaybeUnit): string {
  return `Quantidade (${unitPlural(unit)})`;
}

// só com os 8 dígitos o CEP ganha o hífen, o resto fica como veio
export function formatZipCode(zipCode: string): string {
  const digits = zipCode.replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : zipCode;
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
