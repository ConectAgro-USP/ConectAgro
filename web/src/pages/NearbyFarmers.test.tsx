import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  deferred,
  findCard,
  FIRST_SEARCH,
  joao,
  maria,
  pageOf,
  renderFarmers,
} from "../test/farmers";

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
});
