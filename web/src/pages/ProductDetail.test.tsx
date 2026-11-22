import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import type { ProductDetail as ProductDetailType } from "../api/products";
import {
  anaAsBuyer,
  anaAsManager,
  fakeAuth,
  jsonResponse,
  renderWithAuth,
  sentBody,
  stubFetch,
} from "../test/helpers";
import { ProductDetail } from "./ProductDetail";

const sampleProduct: ProductDetailType = {
  public_id: "prod-123",
  name: "Mandioca Natural",
  description: "Mandioca orgânica plantada no sítio. Sem agrotóxicos e colhida fresca.",
  picture_url: "https://example.com/mandioca.jpg",
  quantity: 25,
  price: "20.00",
  expiration_date: "2026-10-20",
  is_available: true,
  farmer_public_id: "farmer-1",
  created_at: "2026-10-01T10:00:00Z",
  farmer: {
    public_id: "farmer-1",
    short_name: "João Vikator",
    farm_name: "Sítio LabXP",
    picture_url: "https://example.com/joao.jpg",
  },
};

const emptyReviews = {
  average_rating: null,
  reviews_count: 0,
  reviews: [],
};

function renderDetail(
  auth = fakeAuth({ user: anaAsBuyer("APROVADO") }),
  url = "/produtos/prod-123",
) {
  return renderWithAuth(
    <Routes>
      <Route path="/produtos/:publicId" element={<ProductDetail />} />
    </Routes>,
    auth,
    url,
  );
}

describe("ProductDetail", () => {
  it("renders product information including photo, name, description, price, expiration, quantity and farmer", async () => {
    stubFetch(jsonResponse(sampleProduct), jsonResponse(emptyReviews));

    renderDetail();

    expect(screen.getByText("Carregando produto...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mandioca Natural" })).toBeInTheDocument();
    });

    const photo = screen.getByRole("img", { name: "Mandioca Natural" });
    expect(photo).toHaveAttribute("src", "https://example.com/mandioca.jpg");

    expect(screen.getByText("R$ 20,00/kg")).toBeInTheDocument();
    expect(screen.getByText("20/10/2026")).toBeInTheDocument();
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

    expect(screen.getByRole("img", { name: "Sem foto para Mandioca Natural" })).toBeInTheDocument();
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

  it("allows a resident (buyer) to select quantity and register interest successfully", async () => {
    const user = userEvent.setup();
    const interestResponse = {
      public_id: "int-1",
      buyer_public_id: "buyer-1",
      product_public_id: "prod-123",
      product_name: "Mandioca Natural",
      product_status: "Disponível",
      quantity: 5,
      created_at: "2026-11-19T10:00:00Z",
      updated_at: null,
    };

    const fetchMock = stubFetch(
      jsonResponse(sampleProduct),
      jsonResponse(emptyReviews),
      jsonResponse(interestResponse, 201),
    );

    renderDetail(fakeAuth({ user: anaAsBuyer("APROVADO") }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mandioca Natural" })).toBeInTheDocument();
    });

    const quantityInput = screen.getByLabelText("Quantidade");
    expect(quantityInput).toHaveValue("1");

    await user.clear(quantityInput);
    await user.type(quantityInput, "5");
    expect(quantityInput).toHaveValue("5");

    const registerButton = screen.getByRole("button", { name: "Registrar interesse" });
    await user.click(registerButton);

    await waitFor(() => {
      expect(screen.getByText("Interesse registrado com sucesso!")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe("/api/interests");
    expect(sentBody(fetchMock, 2)).toEqual({
      product_public_id: "prod-123",
      quantity: 5,
    });
  });

  it("limits the quantity input to 0 through 50 and prevents requesting more than stock", async () => {
    const user = userEvent.setup();
    stubFetch(
      jsonResponse(sampleProduct),
      jsonResponse(emptyReviews),
    );

    renderDetail();
    const quantityInput = await screen.findByLabelText("Quantidade");
    await user.clear(quantityInput);
    await user.type(quantityInput, "51");
    expect(quantityInput).toHaveValue("5");

    await user.clear(quantityInput);
    await user.type(quantityInput, "50");
    expect(quantityInput).toHaveValue("50");
    expect(screen.getByRole("alert")).toHaveTextContent("excede o estoque disponível");
    expect(screen.getByRole("button", { name: "Registrar interesse" })).toBeDisabled();

    await user.clear(quantityInput);
    await user.type(quantityInput, "0");
    expect(quantityInput).toHaveValue("0");
    expect(screen.getByRole("button", { name: "Registrar interesse" })).toBeDisabled();
  });

  it("shows error when registering interest fails", async () => {
    const user = userEvent.setup();
    const errorResponse = { detail: "Interesse nesse produto já registrado" };

    stubFetch(
      jsonResponse(sampleProduct),
      jsonResponse(emptyReviews),
      jsonResponse(errorResponse, 409),
    );

    renderDetail(fakeAuth({ user: anaAsBuyer("APROVADO") }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mandioca Natural" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Registrar interesse" }));

    await waitFor(() => {
      expect(screen.getByText("Interesse nesse produto já registrado")).toBeInTheDocument();
    });
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

  it("disables interest and selection when product has zero quantity or is unavailable", async () => {
    const unavailableProduct: ProductDetailType = {
      ...sampleProduct,
      quantity: 0,
      is_available: false,
    };

    stubFetch(
      jsonResponse(unavailableProduct),
      jsonResponse(emptyReviews),
    );

    renderDetail(fakeAuth({ user: anaAsBuyer("APROVADO") }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mandioca Natural" })).toBeInTheDocument();
    });

    expect(screen.getByText("Indisponível")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Registrar interesse" })).toBeDisabled();
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

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

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
