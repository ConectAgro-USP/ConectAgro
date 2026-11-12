import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fetchHistory, type HistoryFilters, type HistoryPage } from "../../api/history";
import { useHistory } from "../../hooks/useHistory";
import { fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../../test/helpers";
import { HistoryLayout } from "./HistoryLayout";

interface Order {
  store_id: string;
  store: string;
}

const STATUS_LABELS = { "EM PROGRESSO": "A caminho", ENTREGUE: "Entregue", CANCELADA: "Cancelada" };
const LOAD_MORE = "Mostrar pedidos mais antigos";
const feira: Order = { store_id: "loja-1", store: "Feira da Vila" };
const horta: Order = { store_id: "loja-2", store: "Horta do Bairro" };
const STORES = [
  { public_id: "loja-1", name: "Feira da Vila" },
  { public_id: "loja-2", name: "Horta do Bairro" },
];

function loadOrders(filters: HistoryFilters, page: number) {
  return fetchHistory<Order>("/orders", "store_id", filters, page);
}

function Orders() {
  const history = useHistory(loadOrders);

  return (
    <HistoryLayout
      title="Pedidos"
      history={history}
      statusLabels={STATUS_LABELS}
      counterpartLabel="Loja"
      emptyMessage="Nenhum pedido ainda"
    >
      <ul>
        {history.items.map((order) => (
          <li key={order.store_id}>{order.store}</li>
        ))}
      </ul>
    </HistoryLayout>
  );
}

function pageOf(items: Order[], extra: Partial<HistoryPage<Order>> = {}): Response {
  const totals = { realized_total: "0.00", expected_total: "0.00" };
  return jsonResponse({ items, page: 1, total_pages: 1, ...totals, counterparts: STORES, ...extra });
}

function renderOrders(...responses: Response[]) {
  const fetchMock = stubFetch(...responses);
  const auth = fakeAuth();
  renderWithAuth(<Orders />, auth);
  return { fetchMock, auth };
}

function lastUrl(fetchMock: ReturnType<typeof stubFetch>): string {
  return String(fetchMock.mock.calls.at(-1)?.[0]);
}

// o nome da loja também aparece no filtro, então a lista é lida pelos itens
function expectOrders(...stores: string[]) {
  return waitFor(() => {
    const shown = screen.queryAllByRole("listitem").map((order) => order.textContent);
    expect(shown).toEqual(stores);
  });
}

async function openFilters() {
  await userEvent.click(await screen.findByRole("button", { name: "Filtrar" }));
}

function chooseStatus(label: string) {
  return userEvent.selectOptions(screen.getByLabelText("Status"), label);
}

describe("HistoryLayout", () => {
  it("asks for the first page without filters", async () => {
    const { fetchMock } = renderOrders(pageOf([feira]));

    await expectOrders("Feira da Vila");
    expect(lastUrl(fetchMock)).toBe("/api/orders?page=1");
  });

  it("shows the title and the way back to the home", () => {
    renderOrders(pageOf([feira]));

    expect(screen.getByRole("heading", { name: "Pedidos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
  });

  it("shows the delivered and the open totals", async () => {
    renderOrders(pageOf([feira], { realized_total: "80.02", expected_total: "30.98" }));

    expect(await screen.findByText("Total entregue")).toBeInTheDocument();
    expect(screen.getByText("R$ 80,02")).toBeInTheDocument();
    expect(screen.getByText("Total a caminho")).toBeInTheDocument();
    expect(screen.getByText("R$ 30,98")).toBeInTheDocument();
  });

  it("keeps the filters closed until the button is used", async () => {
    renderOrders(pageOf([feira]));
    await expectOrders("Feira da Vila");

    expect(screen.getByLabelText("Status")).not.toBeVisible();
    await openFilters();

    expect(screen.getByLabelText("Status")).toBeVisible();
  });

  it("filters by status", async () => {
    const { fetchMock } = renderOrders(pageOf([feira, horta]), pageOf([horta]));
    await openFilters();

    await chooseStatus("Entregue");

    await expectOrders("Horta do Bairro");
    expect(lastUrl(fetchMock)).toBe("/api/orders?page=1&status=ENTREGUE");
  });

  it("filters by period", async () => {
    const { fetchMock } = renderOrders(pageOf([feira]), pageOf([feira]), pageOf([feira]));
    await openFilters();

    await userEvent.type(screen.getByLabelText("Pedidos a partir de"), "2026-11-01");
    await userEvent.type(screen.getByLabelText("Pedidos até"), "2026-11-30");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(lastUrl(fetchMock)).toBe("/api/orders?page=1&date_from=2026-11-01&date_to=2026-11-30");
  });

  it("filters by the other side of the order", async () => {
    const { fetchMock } = renderOrders(pageOf([feira, horta]), pageOf([horta]));
    await openFilters();

    await userEvent.selectOptions(screen.getByLabelText("Loja"), "Horta do Bairro");

    await expectOrders("Horta do Bairro");
    expect(lastUrl(fetchMock)).toBe("/api/orders?page=1&store_id=loja-2");
  });

  it("offers in the filter everyone the API lists, even out of the page", async () => {
    renderOrders(pageOf([feira]));
    await openFilters();

    expect(screen.getByRole("option", { name: "Feira da Vila" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Horta do Bairro" })).toBeInTheDocument();
  });

  it("names after the field who comes without a name", async () => {
    renderOrders(pageOf([feira], { counterparts: [{ public_id: "loja-3", name: "" }] }));
    await openFilters();

    expect(screen.getByRole("option", { name: "Loja" })).toHaveValue("loja-3");
  });

  it("counts the filters in use and clears them", async () => {
    const { fetchMock } = renderOrders(pageOf([feira]), pageOf([horta]), pageOf([feira]));
    await openFilters();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();

    await chooseStatus("Cancelada");
    expect(screen.getByRole("button", { name: "Filtros (1)" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    await expectOrders("Feira da Vila");
    expect(screen.getByRole("button", { name: "Filtrar" })).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveValue("");
    expect(lastUrl(fetchMock)).toBe("/api/orders?page=1");
  });

  it("keeps the old orders on screen while the filtered ones load", async () => {
    const fetchMock = stubFetch(pageOf([feira]));
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    renderWithAuth(<Orders />, fakeAuth());
    await openFilters();

    await chooseStatus("Entregue");

    expect(screen.getByRole("status")).toHaveTextContent("Carregando...");
    expect(screen.getByRole("list").parentElement).toHaveAttribute("aria-busy", "true");
    await expectOrders("Feira da Vila");
  });

  it("leaves the orders on screen alone while the older ones load", async () => {
    const fetchMock = stubFetch(pageOf([feira], { total_pages: 2 }));
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    renderWithAuth(<Orders />, fakeAuth());

    await userEvent.click(await screen.findByRole("button", { name: LOAD_MORE }));

    expect(screen.getByRole("status")).toHaveTextContent("Carregando...");
    expect(screen.getByRole("list").parentElement).toHaveAttribute("aria-busy", "false");
  });

  it("says when there is no order yet, without totals", async () => {
    renderOrders(pageOf([], { total_pages: 0 }));

    expect(await screen.findByText("Nenhum pedido ainda")).toBeInTheDocument();
    expect(screen.queryByText("Total entregue")).not.toBeInTheDocument();
  });

  it("says when no order matches the filters", async () => {
    renderOrders(pageOf([feira]), pageOf([], { total_pages: 0 }));
    await openFilters();

    await chooseStatus("Cancelada");

    expect(await screen.findByText("Nenhum pedido com esses filtros")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum pedido ainda")).not.toBeInTheDocument();
  });

  it("adds the older orders below the ones on screen", async () => {
    const { fetchMock } = renderOrders(
      pageOf([feira], { total_pages: 2 }),
      pageOf([horta], { page: 2, total_pages: 2 }),
    );

    await userEvent.click(await screen.findByRole("button", { name: LOAD_MORE }));

    await expectOrders("Feira da Vila", "Horta do Bairro");
    expect(lastUrl(fetchMock)).toBe("/api/orders?page=2");
    expect(screen.queryByRole("button", { name: LOAD_MORE })).not.toBeInTheDocument();
  });

  it("keeps the filters when asking for the older orders", async () => {
    const { fetchMock } = renderOrders(
      pageOf([feira]),
      pageOf([feira], { total_pages: 2 }),
      pageOf([horta], { page: 2, total_pages: 2 }),
    );
    await openFilters();
    await chooseStatus("Entregue");

    await userEvent.click(await screen.findByRole("button", { name: LOAD_MORE }));

    await expectOrders("Feira da Vila", "Horta do Bairro");
    expect(lastUrl(fetchMock)).toBe("/api/orders?page=2&status=ENTREGUE");
  });

  it("goes back to the first page when a filter changes", async () => {
    const { fetchMock } = renderOrders(
      pageOf([feira], { total_pages: 2 }),
      pageOf([horta], { page: 2, total_pages: 2 }),
      pageOf([horta]),
    );
    await userEvent.click(await screen.findByRole("button", { name: LOAD_MORE }));
    await expectOrders("Feira da Vila", "Horta do Bairro");
    await openFilters();

    await chooseStatus("Entregue");

    await expectOrders("Horta do Bairro");
    expect(lastUrl(fetchMock)).toBe("/api/orders?page=1&status=ENTREGUE");
  });

  it("tells the screen reader while the orders load", async () => {
    renderOrders(pageOf([feira]));

    expect(screen.getByRole("status")).toHaveTextContent("Carregando...");
    await expectOrders("Feira da Vila");

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows why the orders did not load and tries again", async () => {
    const detail = "Muitas tentativas. Tente novamente mais tarde";
    renderOrders(jsonResponse({ detail }, 429), pageOf([feira]));

    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
    expect(screen.queryByText("Nenhum pedido ainda")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    await expectOrders("Feira da Vila");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("asks again for the older orders that failed, keeping the ones on screen", async () => {
    const { fetchMock } = renderOrders(
      pageOf([feira], { total_pages: 2 }),
      jsonResponse({}, 500),
      pageOf([horta], { page: 2, total_pages: 2 }),
    );
    await userEvent.click(await screen.findByRole("button", { name: LOAD_MORE }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await expectOrders("Feira da Vila");

    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    await expectOrders("Feira da Vila", "Horta do Bairro");
    expect(lastUrl(fetchMock)).toBe("/api/orders?page=2");
  });

  it("drops the old orders when the filtered ones fail to load", async () => {
    renderOrders(pageOf([feira]), jsonResponse({}, 500));
    await openFilters();

    await chooseStatus("Entregue");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await expectOrders();
    expect(screen.getByRole("option", { name: "Horta do Bairro" })).toBeInTheDocument();
  });

  it.each([401, 403])("reloads the user when the API answers %i", async (status) => {
    const { auth } = renderOrders(jsonResponse({ detail: "Sem acesso" }, status));

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
  });

  it("ignores an answer that arrives after the filters changed", async () => {
    let answerFirst: (response: Response) => void = () => {};
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)));
    fetchMock.mockResolvedValueOnce(pageOf([horta]));
    vi.stubGlobal("fetch", fetchMock);
    renderWithAuth(<Orders />, fakeAuth());
    await userEvent.click(screen.getByRole("button", { name: "Filtrar" }));

    await chooseStatus("Entregue");
    await expectOrders("Horta do Bairro");
    answerFirst(pageOf([feira]));

    // dá tempo de a resposta velha chegar antes de olhar a lista
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expectOrders("Horta do Bairro");
  });
});
