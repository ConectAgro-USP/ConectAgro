import { formatZipCode } from "./format";

describe("formatZipCode", () => {
  it.each([
    ["01310200", "01310-200"],
    ["01310-200", "01310-200"],
    ["0131", "0131"],
  ])("shows %s as %s", (zipCode, shown) => {
    expect(formatZipCode(zipCode)).toBe(shown);
  });
});
