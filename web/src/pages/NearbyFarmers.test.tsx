import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FarmerProduct, NearbyFarmer } from "../api/farmers";
import { anaAsBuyer, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../test/helpers";
import { NearbyFarmers } from "./NearbyFarmers";

const RETRY = "Tentar de novo";
const FIRST_SEARCH = "/api/farmers?max_distance_km=15&page=1&page_size=100";

const maria: NearbyFarmer = {
  public_id: "agricultor-1",
  name: "Maria S.",
  farm_name: "Sítio Boa Vista",
  distance_km: 3.14,
  available_products_count: 2,
  average_rating: 4.5,
  reviews_count: 70,
  on_time_delivery_percentage: 95.5,
};
// recém-chegado: ninguém avaliou nem recebeu entrega dele
const joao: NearbyFarmer = {
  public_id: "agricultor-2",
  name: "João V.",
  farm_name: null,
  distance_km: 12,
  available_products_count: 1,
  average_rating: null,
  reviews_count: 0,
  on_time_delivery_percentage: null,
};

const laranja: FarmerProduct = {
  public_id: "produto-1",
  name: "Laranja",
  description: "Colhida nesta semana",
  picture_url: "https://example.com/laranja.jpg",
  quantity: 30,
  price: "4.99",
  expiration_date: "2026-12-10",
};
const mandioca: FarmerProduct = {
  public_id: "produto-2",
  name: "Mandioca",
  description: null,
  picture_url: null,
  quantity: 1,
  price: "7.00",
  expiration_date: "2026-11-30",
};

function pageOf<Item>(items: Item[], page = 1, totalPages = 1, total = items.length): Response {
  return jsonResponse({ items, total, page, page_size: 100, total_pages: totalPages });
}

// o erro simula a rede fora do ar, e a promessa deixa a resposta para depois
function renderFarmers(...answers: (Response | Error | Promise<Response>)[]) {
  const fetchMock = stubFetch();
  for (const answer of answers) {
    if (answer instanceof Error) {
      fetchMock.mockRejectedValueOnce(answer);
    } else {
      fetchMock.mockReturnValueOnce(Promise.resolve(answer));
    }
  }
  const auth = fakeAuth({ user: anaAsBuyer("APROVADO") });
  renderWithAuth(<NearbyFarmers />, auth);
  return { fetchMock, auth };
}

async function findCard(name: string): Promise<HTMLElement> {
  const title = await screen.findByRole("heading", { level: 2, name });
  return title.closest("li")!;
}

function deferred(): { promise: Promise<Response>; resolve: (response: Response) => void } {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("NearbyFarmers", () => {
  it("lists the farmers within 15 km with distance, rating, deliveries and products", async () => {
    const { fetchMock } = renderFarmers(pageOf([maria, joao]));

    const card = await findCard("Maria S.");

    expect(fetchMock.mock.calls[0][0]).toBe(FIRST_SEARCH);
    expect(screen.getByRole("heading", { level: 1, name: "Agricultores" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Até 15 km" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("2 agricultores a até 15 km do seu prédio")).toBeInTheDocument();
    expect(within(card).getByText("Sítio Boa Vista")).toBeInTheDocument();
    expect(card).toHaveTextContent("Distância: 3,1 km");
    expect(card).toHaveTextContent("4,5 de 5 (70 avaliações)");
    expect(card).toHaveTextContent("Entregas no prazo:95,5%");
    expect(card).toHaveTextContent("2 produtos disponíveis");
  });

  it("says when a farmer has no reviews or deliveries yet", async () => {
    renderFarmers(pageOf([joao]));

    const card = await findCard("João V.");

    expect(card).toHaveTextContent("Ainda sem avaliações");
    expect(card).not.toHaveTextContent("Entregas no prazo");
    expect(card).toHaveTextContent("1 produto disponível");
    expect(card).toHaveTextContent("12 km");
    expect(screen.getByText("1 agricultor a até 15 km do seu prédio")).toBeInTheDocument();
  });

  it("names the farm when the farmer signed up without a name", async () => {
    renderFarmers(pageOf([{ ...maria, name: "" }]));

    const card = await findCard("Sítio Boa Vista");

    expect(within(card).getAllByText("Sítio Boa Vista")).toHaveLength(1);
  });

  it("does not offer the products of a farmer who has none", async () => {
    renderFarmers(pageOf([{ ...maria, available_products_count: 0 }]));

    const card = await findCard("Maria S.");

    expect(card).toHaveTextContent("Nenhum produto disponível agora");
    expect(within(card).queryByRole("button", { name: /produtos/ })).not.toBeInTheDocument();
  });

  it("searches again when the distance changes", async () => {
    const { fetchMock } = renderFarmers(pageOf([maria, joao]), pageOf([maria]));
    await findCard("João V.");

    await userEvent.click(screen.getByRole("button", { name: "Até 5 km" }));

    expect(fetchMock.mock.calls[1][0]).toBe("/api/farmers?max_distance_km=5&page=1&page_size=100");
    expect(screen.getByRole("button", { name: "Até 5 km" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Até 15 km" })).toHaveAttribute("aria-pressed", "false");
    expect(await screen.findByText("1 agricultor a até 5 km do seu prédio")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "João V." })).not.toBeInTheDocument();
  });

  it("takes the old list away while the new distance is calculated", async () => {
    const later = deferred();
    renderFarmers(pageOf([joao]), later.promise);
    await findCard("João V.");

    await userEvent.click(screen.getByRole("button", { name: "Até 5 km" }));

    expect(screen.queryByRole("heading", { name: "João V." })).not.toBeInTheDocument();
    expect(screen.queryByText(/agricultor a até/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Calculando as distâncias...");
    later.resolve(pageOf([maria]));
    expect(await findCard("Maria S.")).toBeInTheDocument();
  });

  it("ignores the answer of a distance that is no longer chosen", async () => {
    const slow = deferred();
    renderFarmers(slow.promise, pageOf([maria]));

    await userEvent.click(screen.getByRole("button", { name: "Até 5 km" }));
    await findCard("Maria S.");
    slow.resolve(pageOf([joao]));

    await waitFor(() => expect(screen.getAllByRole("status")[0]).toBeEmptyDOMElement());
    expect(screen.queryByRole("heading", { name: "João V." })).not.toBeInTheDocument();
  });

  it("does not search again when the chosen distance is pressed", async () => {
    const { fetchMock } = renderFarmers(pageOf([maria]));
    await findCard("Maria S.");

    await userEvent.click(screen.getByRole("button", { name: "Até 15 km" }));

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("offers a larger distance when no farmer is that close", async () => {
    const { fetchMock } = renderFarmers(pageOf([maria]), pageOf([]), pageOf([joao]));
    await findCard("Maria S.");
    await userEvent.click(screen.getByRole("button", { name: "Até 5 km" }));

    expect(await screen.findByText("Nenhum agricultor a até 5 km do seu prédio")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Procurar até 10 km" }));

    expect(fetchMock.mock.calls[2][0]).toBe("/api/farmers?max_distance_km=10&page=1&page_size=100");
    expect(await findCard("João V.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Até 10 km" })).toHaveAttribute("aria-pressed", "true");
  });

  it("has no larger distance to offer at 15 km", async () => {
    renderFarmers(pageOf([]));

    expect(await screen.findByText("Nenhum agricultor a até 15 km do seu prédio")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Procurar até/ })).not.toBeInTheDocument();
  });

  it("tells the screen reader while the distances are calculated", async () => {
    renderFarmers(pageOf([maria]));

    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Calculando as distâncias...");
    expect(screen.queryByText(/Nenhum agricultor/)).not.toBeInTheDocument();
    await findCard("Maria S.");

    expect(screen.getAllByRole("status")[0]).toBeEmptyDOMElement();
  });

  it("shows why the distances could not be calculated and tries again", async () => {
    const detail = "Não foi possível calcular as distâncias agora. Tente novamente mais tarde";
    const { fetchMock } = renderFarmers(jsonResponse({ detail }, 503), pageOf([maria]));

    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
    expect(screen.queryByText(/Nenhum agricultor/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: RETRY }));

    await findCard("Maria S.");
    expect(fetchMock.mock.calls[1][0]).toBe(FIRST_SEARCH);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: RETRY })).not.toBeInTheDocument();
  });

  it("asks to try again when the server cannot be reached", async () => {
    renderFarmers(new TypeError("Failed to fetch"), pageOf([maria]));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível falar");
    await userEvent.click(screen.getByRole("button", { name: RETRY }));

    expect(await findCard("Maria S.")).toBeInTheDocument();
  });

  it.each([401, 403])("reloads the user when the API answers %i", async (status) => {
    const { auth } = renderFarmers(jsonResponse({ detail: "Sem acesso" }, status));

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
  });

  it("shows more farmers when there is another page", async () => {
    const { fetchMock } = renderFarmers(pageOf([maria], 1, 2, 2), pageOf([joao], 2, 2, 2));
    await findCard("Maria S.");

    await userEvent.click(screen.getByRole("button", { name: "Mostrar mais agricultores" }));

    expect(await findCard("João V.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/farmers?max_distance_km=15&page=2&page_size=100");
    expect(screen.getByRole("heading", { name: "Maria S." })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mostrar mais/ })).not.toBeInTheDocument();
  });

  describe("products of a farmer", () => {
    async function openProducts(...answers: (Response | Error | Promise<Response>)[]) {
      const rendered = renderFarmers(pageOf([maria]), ...answers);
      const card = await findCard("Maria S.");
      await userEvent.click(within(card).getByRole("button", { name: "Ver produtos" }));
      return { ...rendered, card };
    }

    it("asks for the products only when the card opens", async () => {
      const { fetchMock } = renderFarmers(pageOf([maria]));

      await findCard("Maria S.");

      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("shows the name, stock, expiration and price of each product", async () => {
      const { fetchMock, card } = await openProducts(pageOf([laranja, mandioca]));

      const orange = (await within(card).findByRole("heading", { level: 3, name: "Laranja" }))
        .closest("li")!;
      const cassava = within(card).getByRole("heading", { level: 3, name: "Mandioca" }).closest("li")!;

      expect(fetchMock.mock.calls[1][0]).toBe("/api/products?farmer_public_id=agricultor-1&page=1");
      expect(orange).toHaveTextContent("Colhida nesta semana");
      expect(orange).toHaveTextContent("30 kg disponíveis · Vence 10/12");
      expect(orange).toHaveTextContent("R$ 4,99 por quilo");
      expect(cassava).toHaveTextContent("1 kg disponível · Vence 30/11");
      expect(within(card).getByRole("button", { name: "Ocultar produtos" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    it("keeps the products when the card closes and opens again", async () => {
      const { fetchMock, card } = await openProducts(pageOf([laranja]));
      const orange = await within(card).findByRole("heading", { name: "Laranja" });

      await userEvent.click(within(card).getByRole("button", { name: "Ocultar produtos" }));
      expect(orange).not.toBeVisible();
      await userEvent.click(within(card).getByRole("button", { name: "Ver produtos" }));

      expect(orange).toBeVisible();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("shows a sprout when the picture is missing or does not load", async () => {
      const { card } = await openProducts(pageOf([laranja, mandioca]));
      await within(card).findByRole("heading", { name: "Laranja" });
      const picture = card.querySelector("img")!;

      expect(picture).toHaveAttribute("src", laranja.picture_url);
      expect(card.querySelectorAll("img")).toHaveLength(1);
      fireEvent.error(picture);

      expect(card.querySelector("img")).not.toBeInTheDocument();
    });

    it("tells the screen reader while the products load", async () => {
      const later = deferred();
      const { card } = await openProducts(later.promise);

      expect(within(card).getByRole("status")).toHaveTextContent("Carregando os produtos...");
      later.resolve(pageOf([laranja]));
      await within(card).findByRole("heading", { name: "Laranja" });

      expect(within(card).getByRole("status")).toBeEmptyDOMElement();
    });

    it("shows why the products did not load and tries again", async () => {
      const detail = "Muitas tentativas. Tente novamente mais tarde";
      const { card } = await openProducts(jsonResponse({ detail }, 429), pageOf([laranja]));

      expect(await within(card).findByRole("alert")).toHaveTextContent(detail);
      await userEvent.click(within(card).getByRole("button", { name: RETRY }));

      expect(await within(card).findByRole("heading", { name: "Laranja" })).toBeInTheDocument();
      expect(within(card).queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows more products when there is another page", async () => {
      const { fetchMock, card } = await openProducts(
        pageOf([laranja], 1, 2, 2),
        pageOf([mandioca], 2, 2, 2),
      );
      await within(card).findByRole("heading", { name: "Laranja" });

      await userEvent.click(within(card).getByRole("button", { name: "Mostrar mais produtos" }));

      expect(await within(card).findByRole("heading", { name: "Mandioca" })).toBeInTheDocument();
      expect(fetchMock.mock.calls[2][0]).toBe("/api/products?farmer_public_id=agricultor-1&page=2");
    });

    it("says when the products ran out after the list loaded", async () => {
      const { card } = await openProducts(pageOf([]));

      expect(
        await within(card).findByText("Os produtos deste agricultor acabaram ou venceram."),
      ).toBeVisible();
    });
  });
});
