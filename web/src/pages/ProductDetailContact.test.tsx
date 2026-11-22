import { screen } from "@testing-library/react";
import { anaAsFarmer, anaAsManager, fakeAuth, jsonResponse, stubFetch } from "../test/helpers";
import {
  emptyReviews,
  managerContact,
  renderDetail,
  sampleProduct,
} from "../test/productDetail";

const farmerContact = {
  recipient_name: "João V.",
  cellphone: "55991234567",
  message: "Olá, João V.! Tenho interesse no seu produto Mandioca Natural.",
};

function answers(contact: unknown): Response[] {
  return [jsonResponse(sampleProduct), jsonResponse(contact), jsonResponse(emptyReviews)];
}

describe("ProductDetail, WhatsApp contact", () => {
  it("lets the resident talk to the manager in a new tab, with the message", async () => {
    const fetchMock = stubFetch(...answers(managerContact));

    renderDetail();

    const link = await screen.findByRole("link", { name: "Falar com o síndico" });
    const text = encodeURIComponent(managerContact.message);
    expect(link).toHaveAttribute("href", `https://wa.me/5511987654321?text=${text}`);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/products/prod-123/contact");
  });

  it("lets the manager talk to the farmer, keeping the country code for DDD 55", async () => {
    stubFetch(...answers(farmerContact));

    renderDetail(fakeAuth({ user: anaAsManager }));

    const link = await screen.findByRole("link", { name: "Falar com o agricultor" });
    expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/5555991234567\?text=/);
    expect(screen.queryByRole("link", { name: "Falar com o síndico" })).not.toBeInTheDocument();
  });

  it("disables the button and warns when there is no phone", async () => {
    stubFetch(...answers({ ...managerContact, cellphone: null }));

    renderDetail();

    expect(
      await screen.findByText("O síndico ainda não cadastrou um telefone."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Falar com o síndico" })).toBeDisabled();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the API message when the contact does not load", async () => {
    stubFetch(
      jsonResponse(sampleProduct),
      jsonResponse({ detail: "Sem acesso" }, 403),
      jsonResponse(emptyReviews),
    );

    renderDetail(fakeAuth({ user: anaAsManager }));

    expect(await screen.findByText("Sem acesso")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Falar com o agricultor" })).toBeDisabled();
  });

  it("shows the product to the farmer without any contact or interest", async () => {
    const fetchMock = stubFetch(jsonResponse(sampleProduct), jsonResponse(emptyReviews));

    renderDetail(fakeAuth({ user: anaAsFarmer }));

    expect(await screen.findByText("Ainda sem avaliações")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Quantidade")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
