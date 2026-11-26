import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Sale } from "../api/sales";
import { anaAsFarmer, fakeAuth, jsonResponse, renderWithAuth } from "../test/helpers";
import { deliveredSale, findCard, pendingSale, press } from "../test/sales";
import { MySales } from "./MySales";

const ACACIAS = "Edifício Jardim das Acácias";
const older: Sale = { ...pendingSale, purchase_public_id: "compra-9", building_name: "Antigo" };

function page(sales: Sale[], number: number, totalPages: number): Response {
  return jsonResponse({
    items: sales,
    page: number,
    page_size: 1,
    total_pages: totalPages,
    realized_total: "0.00",
    expected_total: "21.00",
    counterparts: [],
  });
}

// a entrega fica no caminho até o teste soltar a resposta dela
function renderSlowDelivery(answer: (url: URL) => Response) {
  let release = () => {};
  const delivered = new Promise<Response>((resolve) => {
    release = () => resolve(jsonResponse({}));
  });
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === "PATCH" ? delivered : answer(new URL(String(input), "http://localhost")),
  );
  vi.stubGlobal("fetch", fetchMock);
  renderWithAuth(<MySales />, fakeAuth({ user: anaAsFarmer }));
  return { fetchMock, release };
}

async function startDelivering() {
  const card = await findCard("Cond. Village Vila Verde");
  await press(card, "Marcar como entregue");
  await press(card, "Confirmar entrega");
}

describe("MySales, a delivery that takes a while", () => {
  it("rereads with the filter chosen while the delivery was on its way", async () => {
    const { fetchMock, release } = renderSlowDelivery((url) =>
      url.searchParams.get("status") === "ENTREGUE"
        ? page([deliveredSale], 1, 1)
        : page([pendingSale], 1, 1),
    );
    await startDelivering();
    await userEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    await userEvent.selectOptions(screen.getByLabelText("Status"), "ENTREGUE");
    await findCard(ACACIAS);
    const before = fetchMock.mock.calls.length;

    release();

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
    const reread = fetchMock.mock.calls.slice(before).map(([url]) => String(url));
    expect(reread.every((url) => url.includes("status=ENTREGUE"))).toBe(true);
    expect(screen.getByLabelText("Status")).toHaveValue("ENTREGUE");
    expect(await findCard(ACACIAS)).toBeInTheDocument();
  });

  it("keeps the older page loaded while the delivery was on its way", async () => {
    const { fetchMock, release } = renderSlowDelivery((url) =>
      url.searchParams.get("page") === "2" ? page([older], 2, 2) : page([pendingSale], 1, 2),
    );
    await startDelivering();
    await userEvent.click(screen.getByRole("button", { name: "Mostrar pedidos mais antigos" }));
    await findCard("Antigo");
    const before = fetchMock.mock.calls.length;

    release();

    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(before + 2));
    const reread = fetchMock.mock.calls.slice(before).map(([url]) => String(url));
    expect(reread.some((url) => url.includes("page=2"))).toBe(true);
    expect(await findCard("Antigo")).toBeInTheDocument();
  });
});
