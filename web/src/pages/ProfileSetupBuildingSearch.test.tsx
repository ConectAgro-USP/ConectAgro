import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  edificioBauru,
  confirmBuilding,
  NAME_SEARCH_WAIT,
  searchByCnpj,
  searchByName,
  typeInto,
} from "../test/buildings";
import {
  ana,
  fakeAuth,
  jsonResponse,
  renderWithAuth,
  sentBody,
  stubFetch,
  villageVilaVerdeMatch,
} from "../test/helpers";
import { ProfileSetup } from "./ProfileSetup";

async function openBuyerForm() {
  const auth = fakeAuth({ user: ana });
  renderWithAuth(<ProfileSetup />, auth);
  await userEvent.click(screen.getByText("Quero comprar"));
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
  await typeInto("Celular", "11944644502");
  await typeInto("CPF", "52998224725");
  await typeInto("Apartamento", "42");
  return auth;
}

function conclude() {
  return userEvent.click(screen.getByRole("button", { name: "Concluir cadastro" }));
}

describe("building search on sign-up", () => {
  it("finds the building by name with its address and CEP", async () => {
    const fetchMock = stubFetch(
      jsonResponse([villageVilaVerdeMatch]),
      jsonResponse({ ...ana, profile_type: "buyer" }, 201),
    );
    const auth = await openBuyerForm();

    await typeInto("Nome do prédio", " vila verde");
    expect(await screen.findByText("CEP 09450-000", {}, NAME_SEARCH_WAIT)).toBeInTheDocument();
    expect(screen.getByText(/^Rua Quatro, 251/)).toBeInTheDocument();
    await confirmBuilding();
    await conclude();

    await waitFor(() => expect(auth.saveProfile).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/apartments?name=vila+verde");
    expect(sentBody(fetchMock, 1)).toMatchObject({
      apartment_public_id: villageVilaVerdeMatch.public_id,
    });
  });

  it("lets the buyer pick one of the buildings with the name", async () => {
    stubFetch(jsonResponse([villageVilaVerdeMatch, edificioBauru]));
    await openBuyerForm();

    await typeInto("Nome do prédio", "Edif");

    const group = await screen.findByRole(
      "group",
      { name: "Qual destes é o seu prédio?" },
      NAME_SEARCH_WAIT,
    );
    expect(group).toHaveTextContent("CEP 01310-200");
    expect(screen.getByRole("radio", { name: /^Edifício Bauru/ })).toBeInTheDocument();
  });

  it("still finds the building by CNPJ", async () => {
    const fetchMock = stubFetch(jsonResponse([edificioBauru]));
    await openBuyerForm();

    await searchByCnpj();
    await typeInto("CNPJ do Prédio", "60.701.190/0001-04");

    expect(await screen.findByLabelText("Este é o seu condomínio?")).toBeInTheDocument();
    expect(screen.getByText("Edifício Bauru")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/apartments?cnpj=60.701.190%2F0001-04");
  });

  it("tells the buyer when no building has the name", async () => {
    const fetchMock = stubFetch(jsonResponse([]));
    const auth = await openBuyerForm();

    await typeInto("Nome do prédio", "Solar das Flores");
    const alert = await screen.findByRole("alert", {}, NAME_SEARCH_WAIT);
    await conclude();

    expect(alert).toHaveTextContent("Nenhum prédio cadastrado com este nome");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(auth.saveProfile).not.toHaveBeenCalled();
  });

  it("asks for at least 3 letters before searching", async () => {
    const fetchMock = stubFetch();
    await openBuyerForm();

    await typeInto("Nome do prédio", "Vi");
    await conclude();

    const field = screen.getByLabelText("Nome do prédio");
    expect(field).toHaveAccessibleDescription("Digite ao menos 3 letras do nome.");
    expect(screen.getByRole("alert")).toHaveTextContent("Informe ao menos 3 letras do nome");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the API refusal of a short name and does not repeat it", async () => {
    const short = { detail: "Informe ao menos 3 letras do nome do prédio" };
    const fetchMock = stubFetch(jsonResponse(short, 422));
    await openBuyerForm();

    await typeInto("Nome do prédio", "Ed.ª");
    const alert = await screen.findByRole("alert", {}, NAME_SEARCH_WAIT);
    await conclude();

    expect(alert).toHaveTextContent("Informe ao menos 3 letras do nome do prédio");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("forgets the confirmed building when the search changes", async () => {
    const fetchMock = stubFetch(jsonResponse([villageVilaVerdeMatch]));
    const auth = await openBuyerForm();
    await typeInto("Nome do prédio", "Village");
    await screen.findByLabelText("Este é o seu condomínio?", {}, NAME_SEARCH_WAIT);
    await confirmBuilding();

    await searchByCnpj();
    expect(screen.queryByLabelText("Este é o seu condomínio?")).not.toBeInTheDocument();
    await searchByName();
    await conclude();

    expect(screen.getByLabelText("Este é o seu condomínio?")).not.toBeChecked();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(auth.saveProfile).not.toHaveBeenCalled();
  });
});
