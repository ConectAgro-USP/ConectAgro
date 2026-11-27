import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { shrinkPicture } from "../components/products/shrinkPicture";
import { jsonResponse, sentBody } from "../test/helpers";
import {
  choosePicture,
  findCard,
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

async function changeField(label: string, value: string) {
  await userEvent.clear(screen.getByLabelText(label));
  await userEvent.type(screen.getByLabelText(label), value);
}

async function editAndFailThePhoto(label: string, value: string, answer: object) {
  const fetchMock = renderProducts(
    productsResponse([orange]),
    jsonResponse(answer),
    jsonResponse({ detail: "Erro interno" }, 500),
    jsonResponse(answer),
    jsonResponse({ ...answer, picture_url: UPLOADED_URL }),
  );
  await press(await findCard("Laranja"), "Editar");
  await changeField(label, value);
  await choosePicture("Trocar foto");
  await save();
  await screen.findByRole("alert");
  return fetchMock;
}

describe("MyProducts, saving again after the photo failed", () => {
  beforeEach(() => {
    stubPreviews();
    vi.mocked(shrinkPicture).mockResolvedValue(SHRUNK);
  });

  it("still leaves out the stock the farmer did not touch", async () => {
    // uma compra baixou o estoque de 12 para 9 desde que a lista abriu
    const answer = { ...orange, quantity: 9, price: "5.75" };
    const fetchMock = await editAndFailThePhoto("Preço por quilo (R$)", "5.75", answer);

    await save();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(sentBody(fetchMock, 1)).toEqual({ price: "5.75" });
    // o preço já foi, e o estoque de 12 na tela não volta por cima dos 9
    expect(sentBody(fetchMock, 3)).toEqual({});
  });

  it("sends the stock the farmer put back after the first save", async () => {
    const answer = { ...orange, quantity: 15 };
    const fetchMock = await editAndFailThePhoto("Quantidade (kg)", "15", answer);
    await changeField("Quantidade (kg)", "12");

    await save();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(sentBody(fetchMock, 1)).toEqual({ quantity: 15 });
    expect(sentBody(fetchMock, 3)).toEqual({ quantity: 12 });
  });
});
