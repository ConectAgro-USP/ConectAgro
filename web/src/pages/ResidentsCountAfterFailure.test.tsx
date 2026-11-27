import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse, pageResponse } from "../test/helpers";
import { bia, findCard, press, renderResidents, tita } from "../test/residents";

const MORE = { name: "Mostrar mais moradores" };
// 21 pedidos em duas páginas, e a segunda não chega
const BEFORE = { total: 21, total_pages: 2 };

describe("Residents, count after a page that failed", () => {
  it("keeps counting the answers given when more requests fail to load", async () => {
    renderResidents(
      pageResponse([tita, bia], BEFORE),
      jsonResponse(tita),
      new TypeError("Failed to fetch"),
      jsonResponse(bia),
    );
    await press(await findCard("Tita Russell"), "Aprovar");
    expect(await screen.findByText("20 pedidos esperando sua resposta")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", MORE));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("20 pedidos esperando sua resposta")).toBeInTheDocument();
    await press(await findCard("Bia Lima"), "Aprovar");
    expect(await screen.findByText("19 pedidos esperando sua resposta")).toBeInTheDocument();
  });
});
