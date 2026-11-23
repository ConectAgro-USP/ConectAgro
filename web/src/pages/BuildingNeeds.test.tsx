import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BuildingNeed } from "../api/interests";
import { anaAsManager, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../test/helpers";
import { sampleProduct } from "../test/productDetail";
import { BuildingNeeds } from "./BuildingNeeds";

const NEEDS_URL = "/api/apartments/me/needs";
const mandioca: BuildingNeed = {
  product: { ...sampleProduct, public_id: "produto-1", name: "Mandioca" },
  total_quantity: 12,
  interested_buyers_count: 3,
};
const alface: BuildingNeed = {
  product: { ...sampleProduct, public_id: "produto-2", name: "Alface" },
  total_quantity: 5,
  interested_buyers_count: 2,
};
const laranja: BuildingNeed = {
  product: {
    ...sampleProduct,
    public_id: "produto-3",
    name: "Laranja",
    farmer_public_id: "agricultor-2",
    farmer: { public_id: "agricultor-2", short_name: "", farm_name: null, picture_url: null },
  },
  total_quantity: 1,
  interested_buyers_count: 1,
};

function renderNeeds(...responses: Response[]) {
  const fetchMock = stubFetch(...responses);
  const auth = fakeAuth({ user: anaAsManager });
  renderWithAuth(<BuildingNeeds />, auth);
  return { fetchMock, auth };
}

async function findCard(name: string): Promise<HTMLElement> {
  return (await screen.findByRole("heading", { name })).closest("li")!;
}

function toggle(name: string) {
  const checkbox = screen.getByRole("checkbox", { name: new RegExp(`^Selecionar ${name} de`) });
  return userEvent.click(checkbox);
}

function productNames() {
  return screen.queryAllByRole("heading", { level: 2 }).map((title) => title.textContent);
}

describe("BuildingNeeds", () => {
  it("lists the product, farmer, total quantity and residents of each need", async () => {
    const { fetchMock } = renderNeeds(jsonResponse([mandioca, laranja]));

    expect(screen.getByRole("status")).toHaveTextContent("Carregando...");
    const card = await findCard("Mandioca");

    expect(screen.getByRole("button", { name: "Maior primeiro" })).toBePressed();
    expect(within(card).getByText("João Vikator, Sítio LabXP")).toBeVisible();
    expect(within(card).getByText("12 kg no total, de 3 moradores interessados")).toBeVisible();
    const nameless = await findCard("Laranja");
    expect(within(nameless).getByText("Agricultor")).toBeVisible();
    expect(within(nameless).getByText("1 kg no total, de 1 morador interessado")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      `${NEEDS_URL}?descending=true`,
      expect.anything(),
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("asks the API for the other order and keeps the selection", async () => {
    const { fetchMock } = renderNeeds(
      jsonResponse([mandioca, alface, laranja]),
      jsonResponse([laranja, alface, mandioca]),
    );
    await findCard("Mandioca");
    await toggle("Mandioca");

    await userEvent.click(screen.getByRole("button", { name: "Menor primeiro" }));

    await waitFor(() => expect(productNames()).toEqual(["Laranja", "Alface", "Mandioca"]));
    expect(fetchMock.mock.calls[1][0]).toBe(`${NEEDS_URL}?descending=false`);
    expect(screen.getByRole("button", { name: "Menor primeiro" })).toBePressed();
    expect(screen.getByRole("button", { name: "Maior primeiro" })).not.toBePressed();
    const mandiocaBox = { name: "Selecionar Mandioca de João Vikator, Sítio LabXP" };
    expect(screen.getByRole("checkbox", mandiocaBox)).toBeChecked();
  });

  it("counts the products and the farmers selected for a purchase", async () => {
    renderNeeds(jsonResponse([mandioca, alface, laranja]));
    await findCard("Mandioca");

    await toggle("Mandioca");
    await toggle("Alface");
    expect(screen.getByText("2 produtos selecionados, de 1 agricultor")).toBeVisible();
    await toggle("Laranja");
    expect(screen.getByText("3 produtos selecionados, de 2 agricultores")).toBeVisible();
    await toggle("Mandioca");
    await toggle("Alface");
    expect(screen.getByText("1 produto selecionado, de 1 agricultor")).toBeVisible();
    await toggle("Laranja");
    expect(screen.queryByText(/selecionad/)).not.toBeInTheDocument();
  });

  it("says clearly when no resident has shown interest", async () => {
    renderNeeds(jsonResponse([]));

    expect(await screen.findByText(/Ainda não há interesses dos moradores/)).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows why the other order did not load and tries it again", async () => {
    const detail = "Muitas tentativas. Tente novamente mais tarde";
    const { fetchMock } = renderNeeds(
      jsonResponse([mandioca]),
      jsonResponse({ detail }, 429),
      jsonResponse([mandioca]),
    );
    await findCard("Mandioca");
    await userEvent.click(screen.getByRole("button", { name: "Menor primeiro" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/Ainda não há interesses/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await findCard("Mandioca")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe(`${NEEDS_URL}?descending=false`);
  });

  it.each([401, 403])("reloads the user when the API answers %i", async (status) => {
    const { auth } = renderNeeds(jsonResponse({ detail: "Sem acesso" }, status));

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
  });
});
