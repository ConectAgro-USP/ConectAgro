import { screen } from "@testing-library/react";
import { shrinkPicture } from "../components/products/shrinkPicture";
import { jsonResponse } from "../test/helpers";
import {
  choosePicture,
  fillRequired,
  findCard,
  openNewForm,
  orange,
  renderProducts,
  save,
  SHRUNK,
  stubPreviews,
  UPLOADED_URL,
} from "../test/products";

vi.mock("../components/products/shrinkPicture");

const SAVED = "O produto foi salvo, mas a foto não foi enviada.";
const withoutPicture = { ...orange, picture_url: null };

describe("MyProducts, when the photo does not go", () => {
  beforeEach(() => {
    stubPreviews();
    vi.mocked(shrinkPicture).mockResolvedValue(SHRUNK);
  });

  it.each([
    [413, "A foto deve ter no máximo 1 MB"],
    [415, "Envie uma foto em JPEG, PNG ou WebP"],
  ])("shows in the form why the API refused the photo with %i", async (status, detail) => {
    renderProducts(
      jsonResponse([]),
      jsonResponse(withoutPicture, 201),
      jsonResponse({ detail }, status),
    );
    await openNewForm();
    await choosePicture();
    await fillRequired("Laranja");

    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(`${SAVED} ${detail}`);
    expect(screen.getByRole("heading", { name: "Editar produto" })).toBeInTheDocument();
  });

  it("saves the same product again instead of creating another", async () => {
    const fetchMock = renderProducts(
      jsonResponse([]),
      jsonResponse(withoutPicture, 201),
      jsonResponse({ detail: "A foto deve ter no máximo 1 MB" }, 413),
      jsonResponse(withoutPicture),
      jsonResponse({ ...orange, picture_url: UPLOADED_URL }),
    );
    await openNewForm();
    await choosePicture();
    await fillRequired("Laranja");
    await save();
    await screen.findByRole("alert");

    await save();

    const card = await findCard("Laranja");
    expect(card.querySelector("img")).toHaveAttribute("src", UPLOADED_URL);
    expect(fetchMock.mock.calls[3][0]).toBe("/api/products/produto-1");
    expect(fetchMock.mock.calls[3][1]?.method).toBe("PATCH");
    expect(screen.getAllByRole("heading", { name: "Laranja" })).toHaveLength(1);
  });

  it("tells when the browser cannot open the chosen file", async () => {
    vi.mocked(shrinkPicture).mockRejectedValue(new Error("formato desconhecido"));
    const fetchMock = renderProducts(jsonResponse([]));
    await openNewForm();

    await choosePicture();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível abrir esta foto. Escolha outra, em JPEG ou PNG",
    );
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("waits for the photo to be ready before saving", async () => {
    vi.mocked(shrinkPicture).mockReturnValue(new Promise(() => {}));
    renderProducts(jsonResponse([]));
    await openNewForm();

    await choosePicture();

    expect(screen.getByText("Preparando a foto...")).toBeVisible();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });
});
