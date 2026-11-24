import {
  formatQuantity,
  formatStock,
  formatUnitPrice,
  priceLabel,
  pricePer,
  quantityLabel,
  unitWord,
} from "./format";

describe("unit formatters", () => {
  it.each([
    [5, "kg", "5 kg"],
    [1, "kg", "1 kg"],
    [1, "unidade", "1 unidade"],
    [3, "unidade", "3 unidades"],
    [1, "duzia", "1 dúzia"],
    [2, "duzia", "2 dúzias"],
    [1, "maco", "1 maço"],
    [4, "maco", "4 maços"],
    [1, "litro", "1 litro"],
    [6, "litro", "6 litros"],
    [0, "duzia", "0 dúzias"],
  ])("writes %i in %s as %s", (count, unit, text) => {
    expect(formatQuantity(count, unit)).toBe(text);
  });

  it.each([
    ["7.00", "kg", "R$ 7,00 por quilo"],
    ["12.00", "duzia", "R$ 12,00 por dúzia"],
    ["0.80", "unidade", "R$ 0,80 por unidade"],
    ["2.50", "maco", "R$ 2,50 por maço"],
    ["6.00", "litro", "R$ 6,00 por litro"],
  ])("writes the price %s in %s as %s", (price, unit, text) => {
    expect(formatUnitPrice(price, unit).replace(/\s/g, " ")).toBe(text);
  });

  it("says how much is left in stock with the unit", () => {
    expect(formatStock(1, "duzia")).toBe("1 dúzia disponível");
    expect(formatStock(30, "kg")).toBe("30 kg disponíveis");
    expect(formatStock(3, "maco")).toBe("3 maços disponíveis");
  });

  it("names the unit by itself, as after a quantity field", () => {
    expect(unitWord(1, "litro")).toBe("litro");
    expect(unitWord(0, "litro")).toBe("litros");
    expect(pricePer("unidade")).toBe("por unidade");
  });

  it("writes the form labels after the unit", () => {
    expect(priceLabel("kg")).toBe("Preço por quilo (R$)");
    expect(quantityLabel("kg")).toBe("Quantidade (kg)");
    expect(priceLabel("duzia")).toBe("Preço por dúzia (R$)");
    expect(quantityLabel("duzia")).toBe("Quantidade (dúzias)");
  });

  it("falls back to the kilo when the unit is missing or unknown", () => {
    expect(formatQuantity(2, undefined)).toBe("2 kg");
    expect(formatQuantity(2, null)).toBe("2 kg");
    expect(pricePer("caixa")).toBe("por quilo");
    expect(pricePer("toString")).toBe("por quilo");
  });
});
