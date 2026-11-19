import { fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "../test/helpers";
import {
  deferred,
  findCard,
  laranja,
  mandioca,
  maria,
  pageOf,
  renderFarmers,
  RETRY,
} from "../test/farmers";

async function openProducts(...answers: (Response | Error | Promise<Response>)[]) {
  const rendered = renderFarmers(pageOf([maria]), ...answers);
  const card = await findCard("Maria S.");
  await userEvent.click(within(card).getByRole("button", { name: "Ver produtos" }));
  return { ...rendered, card };
}

describe("NearbyFarmers, products of a farmer", () => {
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
    expect(orange).toHaveTextContent("30 kg disponíveis · Vence 10/12/2026");
    expect(orange).toHaveTextContent("R$ 4,99 por quilo");
    expect(cassava).toHaveTextContent("1 kg disponível · Vence 30/11/2026");
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

  it("shows a product repeated on the next page only once", async () => {
    const { card } = await openProducts(
      pageOf([laranja], 1, 2, 2),
      pageOf([laranja, mandioca], 2, 2, 2),
    );
    await within(card).findByRole("heading", { name: "Laranja" });

    await userEvent.click(within(card).getByRole("button", { name: "Mostrar mais produtos" }));

    await within(card).findByRole("heading", { name: "Mandioca" });
    expect(within(card).getAllByRole("heading", { name: "Laranja" })).toHaveLength(1);
  });

  it("says when the products ran out after the list loaded", async () => {
    const { card } = await openProducts(pageOf([]));

    expect(await within(card).findByText("Nenhum produto disponível agora.")).toBeVisible();
  });

  it("offers the products of a farmer who had none when the list loaded", async () => {
    renderFarmers(pageOf([{ ...maria, available_products_count: 0 }]), pageOf([laranja]));
    const card = await findCard("Maria S.");

    expect(card).toHaveTextContent("Nenhum produto disponível agora");
    await userEvent.click(within(card).getByRole("button", { name: "Ver produtos" }));

    expect(await within(card).findByRole("heading", { name: "Laranja" })).toBeVisible();
  });
});
