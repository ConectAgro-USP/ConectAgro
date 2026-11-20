import { screen, within } from "@testing-library/react";
import App from "../App";
import { anaAsManager, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../test/helpers";
import { orange, renderProducts } from "../test/products";

describe("MyProducts", () => {
  it("loads the farmer's products and shows their photo and details", async () => {
    const fetchMock = renderProducts(jsonResponse([orange]));

    const title = await screen.findByRole("heading", { name: "Laranja" });
    const card = title.closest("li")!;
    expect(fetchMock.mock.calls[0][0]).toBe("/api/products/me");
    expect(within(card).getByRole("img", { name: "Laranja" })).toHaveAttribute(
      "src",
      orange.picture_url,
    );
    expect(card).toHaveTextContent("R$ 4,99");
    expect(card).toHaveTextContent("12 kg");
    expect(card).toHaveTextContent("25/10/2030");
  });

  it("restricts the route to farmers", async () => {
    const fetchMock = stubFetch();
    renderWithAuth(<App />, fakeAuth({ user: anaAsManager }), "/meus-produtos");

    expect(screen.getByRole("heading", { name: "Olá, Ana Souza" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
