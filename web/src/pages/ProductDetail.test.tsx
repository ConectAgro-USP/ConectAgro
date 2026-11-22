import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProductDetail as ProductDetailType } from "../api/products";
import { anaAsBuyer, anaAsManager, fakeAuth, jsonResponse, stubFetch } from "../test/helpers";
import { emptyReviews, renderDetail, sampleProduct } from "../test/productDetail";

describe("ProductDetail", () => {
  it("renders product information including photo, name, description, price, expiration, quantity and farmer", async () => {
    stubFetch(jsonResponse(sampleProduct), jsonResponse(emptyReviews));

    renderDetail();

    expect(screen.getByText("Carregando produto...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mandioca Natural" })).toBeInTheDocument();
    });

    expect(document.querySelector("img")).toHaveAttribute("src", "https://example.com/mandioca.jpg");

    expect(screen.getByText("R$ 20,00/kg")).toBeInTheDocument();
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
    stubFetch(jsonResponse(productWithoutPhoto), jsonResponse(emptyReviews));

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
    const reviews = { average_rating: 4.5, reviews_count: 2, reviews: [] };
    const fetchMock = stubFetch(jsonResponse(sampleProduct), jsonResponse(reviews));

    renderDetail();

    const seller = (await screen.findByText("Vendido por")).parentElement!.parentElement!;
    await waitFor(() => expect(seller).toHaveTextContent("4,5 de 5 (2 avaliações)"));
    expect(fetchMock.mock.calls[1][0]).toBe("/api/farmers/farmer-1/reviews");
  });

  it("names the farmer by the farm, or just Agricultor, without a short name", async () => {
    const farmer = { ...sampleProduct.farmer, short_name: "", picture_url: null };
    stubFetch(
      jsonResponse({ ...sampleProduct, farmer }),
      jsonResponse(emptyReviews),
      jsonResponse({ ...sampleProduct, farmer: { ...farmer, farm_name: null } }),
      jsonResponse(emptyReviews),
    );

    const { unmount } = renderDetail();

    expect(await screen.findByText("Sítio LabXP")).toBeInTheDocument();
    expect(screen.queryByText("(Sítio LabXP)")).not.toBeInTheDocument();
    unmount();
    renderDetail();
    expect(await screen.findByText("Agricultor")).toBeInTheDocument();
  });

  it("shows WhatsApp button for resident and opens chat link", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const contactResponse = {
      recipient_name: "Carlos Síndico",
      cellphone: "(11) 98765-4321",
      message: "Olá, Carlos! Tenho interesse no produto Mandioca Natural.",
    };

    const fetchMock = stubFetch(
      jsonResponse(sampleProduct),
      jsonResponse(emptyReviews),
      jsonResponse(contactResponse),
    );

    renderDetail(fakeAuth({ user: anaAsBuyer("APROVADO") }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mandioca Natural" })).toBeInTheDocument();
    });

    const chatButton = screen.getByRole("button", { name: "Conversar no WhatsApp" });
    await user.click(chatButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/products/prod-123/contact",
        expect.anything(),
      );
    });

    expect(openSpy).toHaveBeenCalledWith(
      "https://wa.me/5511987654321?text=Ol%C3%A1%2C%20Carlos!%20Tenho%20interesse%20no%20produto%20Mandioca%20Natural.",
      "_blank",
      "noopener,noreferrer",
    );

    openSpy.mockRestore();
  });

  it("shows WhatsApp button for manager with customized label and does not show register interest button", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const contactResponse = {
      recipient_name: "João Vikator",
      cellphone: "11999998888",
      message: "Olá, João! Tenho interesse no produto Mandioca Natural.",
    };

    const fetchMock = stubFetch(
      jsonResponse(sampleProduct),
      jsonResponse(emptyReviews),
      jsonResponse(contactResponse),
    );

    renderDetail(fakeAuth({ user: anaAsManager }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mandioca Natural" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Registrar interesse" })).not.toBeInTheDocument();

    const managerChatButton = screen.getByRole("button", {
      name: "Conversar com o agricultor no WhatsApp",
    });
    await user.click(managerChatButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/products/prod-123/contact",
        expect.anything(),
      );
    });

    expect(openSpy).toHaveBeenCalledWith(
      "https://wa.me/5511999998888?text=Ol%C3%A1%2C%20Jo%C3%A3o!%20Tenho%20interesse%20no%20produto%20Mandioca%20Natural.",
      "_blank",
      "noopener,noreferrer",
    );

    openSpy.mockRestore();
  });

  it("shows friendly error when contact phone is not provided", async () => {
    const user = userEvent.setup();
    const contactWithoutPhone = {
      recipient_name: "João Vikator",
      cellphone: null,
      message: "Olá!",
    };

    stubFetch(
      jsonResponse(sampleProduct),
      jsonResponse(emptyReviews),
      jsonResponse(contactWithoutPhone),
    );

    renderDetail(fakeAuth({ user: anaAsManager }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mandioca Natural" })).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Conversar com o agricultor no WhatsApp" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Telefone não informado para contato")).toBeInTheDocument();
    });
  });

  it("shows error and allows retrying when loading product fails", async () => {
    stubFetch(
      jsonResponse({ detail: "Produto não encontrado" }, 404),
      jsonResponse(sampleProduct),
      jsonResponse(emptyReviews),
    );

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText("Produto não encontrado")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mandioca Natural" })).toBeInTheDocument();
    });
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

    stubFetch(
      jsonResponse(productWithLongDesc),
      jsonResponse(emptyReviews),
    );

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
