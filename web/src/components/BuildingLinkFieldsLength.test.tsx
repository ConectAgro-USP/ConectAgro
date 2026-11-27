import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useBuildingLink } from "../hooks/useBuildingLink";
import { NAME_SEARCH_WAIT, searchByCnpj } from "../test/buildings";
import { ana, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../test/helpers";
import { BuildingLinkFields } from "./BuildingLinkFields";

// um endereço colado no lugar do nome passa dos 150 caracteres da API
const PASTED = "Rua Doutor Antônio Bento, 1234 - ".repeat(6);

function Fields() {
  const link = useBuildingLink({ cnpj: "", block: "", unit: "" });
  return <BuildingLinkFields link={link} />;
}

function renderFields() {
  const fetchMock = stubFetch(jsonResponse([]));
  renderWithAuth(<Fields />, fakeAuth({ user: ana }));
  return fetchMock;
}

describe("BuildingLinkFields, a long building name", () => {
  it("searches with no more than the 150 characters the API accepts", async () => {
    const fetchMock = renderFields();
    const field = screen.getByLabelText("Nome do prédio");

    await userEvent.click(field);
    await userEvent.paste(PASTED);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce(), NAME_SEARCH_WAIT);
    expect(field).toHaveValue(PASTED.slice(0, 150));
    const sent = new URL(String(fetchMock.mock.calls[0][0]), "http://localhost");
    expect(sent.searchParams.get("name")).toBe(PASTED.slice(0, 150).trim());
  });

  it("keeps the CNPJ field without that limit", async () => {
    renderFields();

    await searchByCnpj();

    expect(screen.getByLabelText("CNPJ do Prédio")).not.toHaveAttribute("maxlength");
  });
});
