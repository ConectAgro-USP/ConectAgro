import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProductDetail as ProductDetailType } from "../api/products";
import { anaAsBuyer, fakeAuth, jsonResponse, stubFetch } from "../test/helpers";
import { farmerReviews, pageLoad, renderDetail, sampleProduct } from "../test/productDetail";

describe("ProductDetail", () => {
  it("renders product information including photo, name, description, price, expiration, quantity and farmer", async () => {
    stubFetch(...pageLoad());

    renderDetail();

    expect(screen.getByText("Carregando produto...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mandioca Natural" })).toBeInTheDocument();
    });

    expect(document.querySelector("img")).toHaveAttribute("src", "https://example.com/mandioca.jpg");

    expect(screen.getByText("por quilo").parentElement).toHaveTextContent("R$ 20,00 por quilo");
    expect(screen.getByText("20/10/2099")).toBeInTheDocument();
    expect(screen.getByText("25 kg disponíveis")).toBeInTheDocument();
    expect(screen.getByText(/João Vikator/)).toBeInTheDocument();
    expect(screen.getByText(/\(Sítio LabXP\)/)).toBeInTheDocument();
    expect(
      screen.getByText("Mandioca orgânica plantada no sítio. Sem agrotóxicos e colhida fresca."),
    ).toBeInTheDocument();

    expect(await screen.findByText("Ainda sem avaliações")).toBeInTheDocument();
  });

  it("shows fallback when product has no photo and no description", async () => {
    const productWithoutPhoto: ProductDetailType = {
      ...sampleProduct,
      picture_url: null,
      description: null,
      farmer: {
        ...sampleProduct.farmer,
        picture_url: null,
        farm_name: null,
      },
    };
    stubFetch(...pageLoad(productWithoutPhoto));

    renderDetail();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mandioca Natural" })).toBeInTheDocument();
    });

    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(
      screen.getByText("Nenhuma descrição informada para este produto."),
    ).toBeInTheDocument();
  });

  it("shows the farmer's average and count next to who sells", async () => {
    const reviews = farmerReviews([], 4.5, 2);
    const fetchMock = stubFetch(...pageLoad(sampleProduct, reviews));

    renderDetail();

    const seller = (await screen.findByText("Vendido por")).parentElement!.parentElement!;
    await waitFor(() => expect(seller).toHaveTextContent("4,5 de 5 (2 avaliações)"));
    const reviewsUrl = "/api/farmers/farmer-1/reviews?page=1&with_comment=true";
    expect(fetchMock.mock.calls[2][0]).toBe(reviewsUrl);
  });

  it("names the farmer by the farm, or just Agricultor, without a short name", async () => {
    const farmer = { ...sampleProduct.farmer, short_name: "", picture_url: null };
    stubFetch(
      ...pageLoad({ ...sampleProduct, farmer }),
      ...pageLoad({ ...sampleProduct, farmer: { ...farmer, farm_name: null } }),
    );

    const { unmount } = renderDetail();

    expect(await screen.findByText("Sítio LabXP")).toBeInTheDocument();
    expect(screen.queryByText("(Sítio LabXP)")).not.toBeInTheDocument();
    unmount();
    renderDetail();
    expect(await screen.findByText("Agricultor")).toBeInTheDocument();
  });

  it("shows error and allows retrying when loading product fails", async () => {
    stubFetch(jsonResponse({ detail: "Produto não encontrado" }, 404), ...pageLoad());

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText("Produto não encontrado")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mandioca Natural" })).toBeInTheDocument();
    });
  });

  it("keeps an id with slashes inside the product path of the API", async () => {
    const fetchMock = stubFetch(jsonResponse({ detail: "Produto não encontrado" }, 404));

    renderDetail(fakeAuth({ user: anaAsBuyer("APROVADO") }), "/produtos/..%2Fauth%2Fme");

    expect(await screen.findByText("Produto não encontrado")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/products/..%2Fauth%2Fme");
  });

  it("expands and collapses long product descriptions", async () => {
    const user = userEvent.setup();
    const longDesc =
      "Esta é uma descrição bem longa para testar o comportamento de truncamento e expansão de texto na tela do produto. " +
      "Ela precisa conter mais de duzentos e cinquenta caracteres para acionar o botão de Ler mais. " +
      "Continuando o texto com detalhes sobre como a mandioca é colhida à mão e embalada com muito cuidado para garantir a qualidade.";

    const productWithLongDesc: ProductDetailType = {
      ...sampleProduct,
      description: longDesc,
    };

    stubFetch(...pageLoad(productWithLongDesc));

    renderDetail();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mandioca Natural" })).toBeInTheDocument();
    });

    const readMore = screen.getByRole("button", { name: "Ler mais" });
    expect(readMore).toBeInTheDocument();

    await user.click(readMore);
    expect(screen.getByRole("button", { name: "Ler menos" })).toBeInTheDocument();
    expect(screen.getByText(longDesc)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ler menos" }));
    expect(screen.getByRole("button", { name: "Ler mais" })).toBeInTheDocument();
  });
});
