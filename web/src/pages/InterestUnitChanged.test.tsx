import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
import { findCard, interestsResponse, mandioca, renderInterests } from "../test/interests";
import { sampleProduct } from "../test/productDetail";
import { renderResident } from "../test/productInterest";

const UNIT_CHANGED = "A unidade do produto mudou. Confira a página antes de continuar";
const refusal = () => jsonResponse({ detail: UNIT_CHANGED }, 409);

describe("Interest, product unit changed meanwhile", () => {
  it("shows the API message and reads the product again", async () => {
    const byDozen = jsonResponse({ ...sampleProduct, unit: "duzia" });
    const fetchMock = renderResident([[]], refusal(), byDozen);
    const register = await screen.findByRole("button", { name: "Registrar interesse" });
    expect(screen.getByText("25 kg disponíveis")).toBeInTheDocument();

    await userEvent.click(register);

    expect(await screen.findByText(UNIT_CHANGED)).toBeInTheDocument();
    expect(await screen.findByText("25 dúzias disponíveis")).toBeInTheDocument();
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.filter((url) => url === "/api/products/prod-123")).toHaveLength(2);
  });

  it("shows the API message and reads the interests again", async () => {
    const product = { ...mandioca.product!, unit: "duzia" as const };
    const fetchMock = renderInterests(
      interestsResponse([mandioca]),
      refusal(),
      interestsResponse([{ ...mandioca, product }]),
    );
    const card = await findCard("Mandioca");
    const field = within(card).getByLabelText("Quantidade (kg)");
    await userEvent.clear(field);
    await userEvent.type(field, "8");

    await userEvent.click(within(card).getByRole("button", { name: "Salvar" }));

    expect(await within(card).findByRole("alert")).toHaveTextContent(UNIT_CHANGED);
    expect(await within(card).findByLabelText("Quantidade (dúzias)")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
