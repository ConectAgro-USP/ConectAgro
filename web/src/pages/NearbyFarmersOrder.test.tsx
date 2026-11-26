import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { address } from "../test/address";
import { findCard, joao, maria, pageOf, renderFarmersAt, RETRY } from "../test/farmers";
import { jsonResponse } from "../test/helpers";

const PAGE = "page=1&page_size=100";
const NO_POINT =
  "Não foi possível localizar o CEP do prédio para calcular as distâncias. " +
  "O síndico deve revisar o CEP em Meu perfil";

describe("NearbyFarmers, distance and order", () => {
  it("drops the distance limit", async () => {
    const farFromMap = { ...joao, distance_km: null };
    const { fetchMock } = renderFarmersAt(
      "/agricultores",
      pageOf([maria]),
      pageOf([maria, farFromMap]),
    );
    await findCard("Maria S.");

    await userEvent.click(screen.getByRole("button", { name: "Qualquer distância" }));

    expect(fetchMock.mock.calls[1][0]).toBe(`/api/farmers?${PAGE}`);
    expect(address()).toBe("/agricultores?max_distance_km=qualquer");
    expect(await screen.findByText("2 agricultores encontrados")).toBeVisible();
    expect(await findCard("Maria S.")).toHaveTextContent("Distância: 3,1 km");
    expect(await findCard("João V.")).not.toHaveTextContent("Distância");
    const fifteenKm = screen.getByRole("button", { name: "Até 15 km" });
    expect(fifteenKm).toHaveAttribute("aria-pressed", "false");
  });

  it("offers any distance when nobody is within 15 km", async () => {
    const { fetchMock } = renderFarmersAt("/agricultores", pageOf([]), pageOf([joao]));

    const anyDistance = "Procurar em qualquer distância";
    await userEvent.click(await screen.findByRole("button", { name: anyDistance }));

    expect(fetchMock.mock.calls[1][0]).toBe(`/api/farmers?${PAGE}`);
    expect(await findCard("João V.")).toBeVisible();
  });

  it("orders by distance and back by rating", async () => {
    const { fetchMock } = renderFarmersAt(
      "/agricultores",
      pageOf([maria, joao]),
      pageOf([joao, maria]),
      pageOf([maria, joao]),
    );
    await findCard("Maria S.");
    expect(screen.getByRole("button", { name: "Melhor avaliados" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(screen.getByRole("button", { name: "Mais próximos" }));
    expect(fetchMock.mock.calls[1][0]).toBe(
      `/api/farmers?max_distance_km=15&sort=distance&${PAGE}`,
    );
    expect(address()).toBe("/agricultores?sort=distance");
    await userEvent.click(screen.getByRole("button", { name: "Melhor avaliados" }));

    expect(fetchMock.mock.calls[2][0]).toBe(`/api/farmers?max_distance_km=15&${PAGE}`);
    expect(address()).toBe("/agricultores");
  });

  it("explains a building without a point on the map and searches without distance", async () => {
    const { fetchMock } = renderFarmersAt(
      "/agricultores?sort=distance",
      jsonResponse({ detail: NO_POINT }, 409),
      pageOf([maria]),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(NO_POINT);
    expect(screen.queryByRole("button", { name: RETRY })).not.toBeInTheDocument();
    const withoutDistance = "Ver agricultores sem a distância";
    await userEvent.click(screen.getByRole("button", { name: withoutDistance }));

    expect(fetchMock.mock.calls[1][0]).toBe(`/api/farmers?${PAGE}`);
    expect(address()).toBe("/agricultores?max_distance_km=qualquer");
    expect(await findCard("Maria S.")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("searches without measuring when there is no limit and no order by distance", async () => {
    renderFarmersAt("/agricultores?max_distance_km=qualquer", pageOf([maria]));

    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Procurando os agricultores...");
    const distance = screen.getByRole("group", { name: "Distância" });
    expect(within(distance).getByRole("button", { name: "Qualquer distância" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/Distância em linha reta/)).toBeVisible();
    await findCard("Maria S.");
  });
});
