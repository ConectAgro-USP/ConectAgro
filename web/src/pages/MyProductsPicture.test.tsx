import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { shrinkPicture } from "../components/products/shrinkPicture";
import { jsonResponse, sentBody } from "../test/helpers";
import {
  choosePicture,
  fillRequired,
  findCard,
  openNewForm,
  orange,
  press,
  productsResponse,
  renderProducts,
  save,
  SHRUNK,
  stubPreviews,
  UPLOADED_URL,
} from "../test/products";

vi.mock("../components/products/shrinkPicture");

const withoutPicture = { ...orange, picture_url: null };
const uploaded = { ...orange, picture_url: UPLOADED_URL };

describe("MyProducts, sending the product's photo", () => {
  beforeEach(() => {
    stubPreviews();
    vi.mocked(shrinkPicture).mockResolvedValue(SHRUNK);
  });

  it("takes or picks an image and previews the reduced photo", async () => {
    renderProducts(productsResponse([]));
    await openNewForm();

    expect(screen.getByLabelText("Tirar ou escolher foto")).toHaveAttribute("accept", "image/*");
    await choosePicture();

    expect(vi.mocked(shrinkPicture).mock.calls[0][0]).toHaveProperty("name", "laranja.jpg");
    expect(document.querySelector("form img")).toHaveAttribute("src", "blob:foto");
    expect(screen.getByLabelText("Trocar foto")).toBeInTheDocument();
  });

  it("creates the product first and then sends the photo", async () => {
    const fetchMock = renderProducts(
      productsResponse([]),
      jsonResponse(withoutPicture, 201),
      jsonResponse(uploaded),
    );
    await openNewForm();
    await choosePicture();
    await fillRequired("Laranja");

    await save();

    const card = await findCard("Laranja");
    expect(card.querySelector("img")).toHaveAttribute("src", UPLOADED_URL);
    expect(sentBody(fetchMock, 1)).toMatchObject({ picture_url: null });
    const [url, request] = fetchMock.mock.calls[2];
    expect(url).toBe("/api/products/produto-1/picture");
    expect(request?.method).toBe("POST");
    expect(new Headers(request?.headers).get("Content-Type")).toBe("image/jpeg");
    expect(request?.body).toBe(SHRUNK);
  });

  it("keeps the old link until the new photo arrives", async () => {
    const fetchMock = renderProducts(
      productsResponse([orange]),
      jsonResponse(orange),
      jsonResponse(uploaded),
    );
    await press(await findCard("Laranja"), "Editar");
    await choosePicture("Trocar foto");

    await save();

    await findCard("Laranja");
    expect(sentBody(fetchMock, 1)).not.toHaveProperty("picture_url");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/products/produto-1/picture");
  });

  it("keeps the sent photo when the product is saved without a new one", async () => {
    const fetchMock = renderProducts(productsResponse([uploaded]), jsonResponse(uploaded));
    await press(await findCard("Laranja"), "Editar");

    expect(screen.getByLabelText(/^Link para a imagem/)).toHaveValue("");
    await save();

    await findCard("Laranja");
    expect(sentBody(fetchMock, 1)).not.toHaveProperty("picture_url");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the link as a folded alternative", async () => {
    renderProducts(productsResponse([orange, { ...uploaded, public_id: "b", name: "Couve" }]));
    await press(await findCard("Couve"), "Editar");

    const summary = screen.getByText("Ou cole um link");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    await userEvent.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
  });

  it("opens the link when the product already uses one", async () => {
    renderProducts(productsResponse([orange]));
    await press(await findCard("Laranja"), "Editar");

    expect(screen.getByText("Ou cole um link").closest("details")).toHaveAttribute("open");
    expect(screen.getByLabelText(/^Link para a imagem/)).toHaveValue(orange.picture_url);
  });
});
