import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApartmentMatch, ProfileRead } from "../api/profiles";
import {
  ana,
  fakeAuth,
  jsonResponse,
  renderWithAuth,
  savedUser,
  sentBody,
  stubFetch,
  villageVilaVerde,
  villageVilaVerdeMatch,
} from "../test/helpers";
import { ProfileSetup } from "./ProfileSetup";

const CNPJ = "50.673.649/0001-44";
const copyOfVillage: ApartmentMatch = {
  ...villageVilaVerdeMatch,
  public_id: "0b9f8d2a-1c3e-4f5a-9b7c-6d5e4f3a2b1c",
  building_name: "Village Vila Verde (cópia)",
  manager_short_name: "Bruno C.",
};

function renderSetup() {
  const auth = fakeAuth({ user: ana });
  renderWithAuth(<ProfileSetup />, auth);
  return auth;
}

async function choose(option: string) {
  await userEvent.click(screen.getByText(option));
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

async function fillIn(label: string, text: string) {
  await userEvent.type(screen.getByLabelText(label), text);
}

function conclude() {
  return userEvent.click(screen.getByRole("button", { name: "Concluir cadastro" }));
}

describe("ProfileSetup", () => {
  it("starts with the buyer option selected", () => {
    renderSetup();

    expect(screen.getByRole("radio", { name: "Quero comprar" })).toBeChecked();
  });

  it("logs out from the profile choice", async () => {
    const auth = renderSetup();

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(auth.logout).toHaveBeenCalledOnce();
  });

  it("keeps the choice buttons disabled while logging out", async () => {
    const logout = vi.fn(() => new Promise<void>(() => {}));
    renderWithAuth(<ProfileSetup />, fakeAuth({ user: ana, logout }));

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(screen.getByRole("button", { name: "Sair" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });

  it("forgets the logout error once the user moves on", async () => {
    const logout = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    renderWithAuth(<ProfileSetup />, fakeAuth({ user: ana, logout }));
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível falar");

    await choose("Quero vender");
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("goes back to the choice keeping the chosen profile", async () => {
    renderSetup();
    await choose("Quero vender");

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.getByRole("radio", { name: "Quero vender" })).toBeChecked();
  });

  it("creates the farmer profile with phones, farm and CPF", async () => {
    const farmer: ProfileRead = { ...ana, profile_type: "farmer" };
    const fetchMock = stubFetch(jsonResponse(farmer, 201));
    const auth = renderSetup();
    await choose("Quero vender");

    await fillIn("Celular", "(11) 94464-4502");
    await fillIn("Telefone Fixo (opcional)", " (11) 2464-4502 ");
    await fillIn("Nome do sítio ou da horta", "Sítio Boa Vista");
    await fillIn("CEP do sítio", "01310-200");
    await fillIn("CPF", "529.982.247-25");
    await conclude();

    await waitFor(() => expect(auth.saveProfile).toHaveBeenCalledOnce());
    await expect(savedUser(auth)).resolves.toEqual(farmer);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/profiles/farmer");
    expect(sentBody(fetchMock, 0)).toEqual({
      cpf: "529.982.247-25",
      cellphone: "(11) 94464-4502",
      homephone: "(11) 2464-4502",
      farm_name: "Sítio Boa Vista",
      zip_code: "01310-200",
    });
  });

  it("shows the API message when the profile cannot be created", async () => {
    stubFetch(jsonResponse({ detail: "CPF já cadastrado" }, 409));
    renderSetup();
    await choose("Quero vender");

    await fillIn("Celular", "11944644502");
    await fillIn("Nome do sítio ou da horta", "Sítio Boa Vista");
    await fillIn("CEP do sítio", "01310200");
    await fillIn("CPF", "52998224725");
    await conclude();

    expect(await screen.findByRole("alert")).toHaveTextContent("CPF já cadastrado");
  });

  it("keeps the buttons disabled while the profile is being saved", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    renderSetup();
    await choose("Quero vender");

    await fillIn("Celular", "11944644502");
    await fillIn("Nome do sítio ou da horta", "Sítio Boa Vista");
    await fillIn("CEP do sítio", "01310200");
    await fillIn("CPF", "52998224725");
    await conclude();

    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Concluir cadastro" })).toBeDisabled();
  });

  it("asks the browser for phones without the country code", async () => {
    renderSetup();
    await choose("Quero vender");

    expect(screen.getByLabelText("Celular")).toHaveAttribute("autocomplete", "tel-national");
    expect(screen.getByLabelText("Telefone Fixo (opcional)")).toHaveAttribute(
      "autocomplete",
      "tel-national",
    );
  });

  it("creates the manager profile with the building found by CNPJ", async () => {
    const preview = {
      building_name: "Cond. Village Vila Verde",
      zip_code: "09450000",
      address: "Rua Quatro, 251",
    };
    const manager: ProfileRead = { ...ana, profile_type: "apartment" };
    const fetchMock = stubFetch(jsonResponse(preview), jsonResponse(manager, 201));
    const auth = renderSetup();
    await choose("Sou síndico");

    await fillIn("Celular", "11944644502");
    await fillIn("CPF do síndico", "52998224725");
    await fillIn("CNPJ do Prédio", CNPJ);
    expect(await screen.findByText("Cond. Village Vila Verde")).toBeInTheDocument();
    expect(screen.getByText("Rua Quatro, 251")).toBeInTheDocument();
    const zipCode = screen.getByLabelText("CEP do Prédio");
    expect(zipCode).toHaveValue("09450000");
    await userEvent.clear(zipCode);
    await userEvent.type(zipCode, "09450-001");
    await conclude();

    await waitFor(() => expect(auth.saveProfile).toHaveBeenCalledOnce());
    await expect(savedUser(auth)).resolves.toEqual(manager);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/profiles/apartment/preview?cnpj=50.673.649%2F0001-44",
    );
    expect(sentBody(fetchMock, 1)).toEqual({
      cpf: "52998224725",
      cellphone: "11944644502",
      homephone: null,
      building_cnpj: CNPJ,
      zip_code: "09450-001",
    });
  });

  it("replaces the edited CEP with the registry CEP of the new CNPJ", async () => {
    const first = { building_name: "Village Vila Verde", zip_code: "09450000", address: null };
    const second = { building_name: "Edifício Bauru", zip_code: "01310200", address: null };
    const fetchMock = stubFetch(
      jsonResponse(first),
      jsonResponse(second),
      jsonResponse({ ...ana, profile_type: "apartment" }, 201),
    );
    renderSetup();
    await choose("Sou síndico");
    await fillIn("Celular", "11944644502");
    await fillIn("CPF do síndico", "52998224725");
    const cnpj = screen.getByLabelText("CNPJ do Prédio");
    await userEvent.type(cnpj, CNPJ);
    const editedZipCode = await screen.findByLabelText("CEP do Prédio");
    await userEvent.type(editedZipCode, "1");
    expect(editedZipCode).toHaveValue("094500001");

    await userEvent.clear(cnpj);
    await userEvent.type(cnpj, "60.701.190/0001-04");

    expect(await screen.findByText("Edifício Bauru")).toBeInTheDocument();
    expect(screen.getByLabelText("CEP do Prédio")).toHaveValue("01310200");
    await conclude();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(sentBody(fetchMock, 2)).toMatchObject({ zip_code: "01310200" });
  });

  it("searches for the building again when the manager concludes after a failure", async () => {
    const preview = { building_name: "Cond. Village Vila Verde", zip_code: null, address: null };
    const unavailable = { detail: "Não foi possível consultar o CNPJ agora" };
    const fetchMock = stubFetch(jsonResponse(unavailable, 503), jsonResponse(preview));
    const auth = renderSetup();
    await choose("Sou síndico");

    await fillIn("Celular", "11944644502");
    await fillIn("CPF do síndico", "52998224725");
    await fillIn("CNPJ do Prédio", CNPJ);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível consultar");
    await conclude();

    expect(await screen.findByText("Cond. Village Vila Verde")).toBeInTheDocument();
    expect(screen.getByLabelText("CEP do Prédio")).toHaveValue("");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(auth.saveProfile).not.toHaveBeenCalled();
  });

  it("asks the manager to check an incomplete CNPJ", async () => {
    const fetchMock = stubFetch();
    renderSetup();
    await choose("Sou síndico");

    await fillIn("Celular", "11944644502");
    await fillIn("CPF do síndico", "52998224725");
    await fillIn("CNPJ do Prédio", "50.673.649/0001");
    await conclude();

    expect(screen.getByRole("alert")).toHaveTextContent("Confira o CNPJ do prédio");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates the buyer profile after the building is confirmed", async () => {
    const buyer: ProfileRead = { ...ana, profile_type: "buyer" };
    const fetchMock = stubFetch(jsonResponse([villageVilaVerdeMatch]), jsonResponse(buyer, 201));
    const auth = renderSetup();
    await choose("Quero comprar");

    await fillIn("Celular", "11944644502");
    await fillIn("CNPJ do Prédio", CNPJ);
    await fillIn("CPF", "52998224725");
    await fillIn("Bloco (opcional)", "B");
    await fillIn("Apartamento", "42");
    await userEvent.click(await screen.findByLabelText("Este é o seu condomínio?"));
    await conclude();

    await waitFor(() => expect(auth.saveProfile).toHaveBeenCalledOnce());
    await expect(savedUser(auth)).resolves.toEqual(buyer);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/apartments?cnpj=50.673.649%2F0001-44");
    expect(sentBody(fetchMock, 1)).toEqual({
      cpf: "52998224725",
      cellphone: "11944644502",
      homephone: null,
      apartment_public_id: villageVilaVerde.public_id,
      block: "B",
      unit: "42",
    });
  });

  it("lets the buyer pick one of the buildings that share the CNPJ", async () => {
    const fetchMock = stubFetch(
      jsonResponse([villageVilaVerdeMatch, copyOfVillage]),
      jsonResponse({ ...ana, profile_type: "buyer" }, 201),
    );
    const auth = renderSetup();
    await choose("Quero comprar");

    await fillIn("Celular", "11944644502");
    await fillIn("CNPJ do Prédio", CNPJ);
    await fillIn("CPF", "52998224725");
    await fillIn("Apartamento", "42");
    await userEvent.click(await screen.findByRole("radio", { name: /cópia/ }));
    await conclude();

    await waitFor(() => expect(auth.saveProfile).toHaveBeenCalledOnce());
    expect(screen.getByRole("group", { name: /Qual é o seu/ })).toBeInTheDocument();
    expect(sentBody(fetchMock, 1)).toMatchObject({
      apartment_public_id: copyOfVillage.public_id,
      block: null,
    });
  });

  it("tells apart the buildings that share the CNPJ by their manager", async () => {
    stubFetch(jsonResponse([villageVilaVerdeMatch, copyOfVillage]));
    renderSetup();
    await choose("Quero comprar");

    await fillIn("CNPJ do Prédio", CNPJ);

    const original = await screen.findByRole("radio", {
      name: /^Cond\. Village Vila Verde.*Síndico: Maria S\.$/,
    });
    const copy = screen.getByRole("radio", {
      name: /^Village Vila Verde \(cópia\).*Síndico: Bruno C\.$/,
    });
    expect(original).toBeInTheDocument();
    expect(copy).toBeInTheDocument();
  });

  it("shows the manager of the only building with the CNPJ", async () => {
    stubFetch(jsonResponse([villageVilaVerdeMatch]));
    renderSetup();
    await choose("Quero comprar");

    await fillIn("CNPJ do Prédio", CNPJ);

    expect(await screen.findByText("Síndico: Maria S.")).toBeInTheDocument();
  });

  it("hides the manager line when the API sends no manager name", async () => {
    stubFetch(jsonResponse([{ ...villageVilaVerdeMatch, manager_short_name: "" }]));
    renderSetup();
    await choose("Quero comprar");

    await fillIn("CNPJ do Prédio", CNPJ);

    expect(await screen.findByText("Cond. Village Vila Verde")).toBeInTheDocument();
    expect(screen.queryByText(/Síndico/)).not.toBeInTheDocument();
  });

  it("does not create the buyer profile before the building is confirmed", async () => {
    const fetchMock = stubFetch(jsonResponse([villageVilaVerdeMatch]));
    renderSetup();
    await choose("Quero comprar");

    await fillIn("Celular", "11944644502");
    await fillIn("CNPJ do Prédio", CNPJ);
    await fillIn("CPF", "52998224725");
    await fillIn("Apartamento", "42");
    expect(await screen.findByLabelText("Este é o seu condomínio?")).toBeInvalid();
    await conclude();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("tells the buyer when no building has the CNPJ", async () => {
    const fetchMock = stubFetch(jsonResponse([]));
    renderSetup();
    await choose("Quero comprar");

    await fillIn("Celular", "11944644502");
    await fillIn("CNPJ do Prédio", CNPJ);
    await fillIn("CPF", "52998224725");
    await fillIn("Apartamento", "42");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nenhum prédio cadastrado com este CNPJ",
    );
    await conclude();

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
