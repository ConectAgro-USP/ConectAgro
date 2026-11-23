import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProfileRead } from "../api/profiles";
import { AuthProvider } from "../auth/AuthProvider";
import {
  ana,
  anaAsBuyer,
  fakeAuth,
  jsonResponse,
  renderWithAuth,
  savedUser,
  sentBody,
  stubFetch,
  villageVilaVerde,
} from "../test/helpers";
import { MyProfile } from "./MyProfile";

const PHONES = { cellphone: "11940028922", homephone: "1140028922" };
const resident: ProfileRead = { ...anaAsBuyer("APROVADO"), ...PHONES };
const residentWithoutBlock: ProfileRead = {
  ...resident,
  buyer: { block: null, unit: "42", link_status: "APROVADO", apartment: villageVilaVerde },
};
const farmer: ProfileRead = {
  ...ana,
  ...PHONES,
  profile_type: "farmer",
  farmer: { farm_name: "Sítio Boa Vista", zip_code: "01310200" },
};
const manager: ProfileRead = {
  ...ana,
  ...PHONES,
  profile_type: "apartment",
  apartment: villageVilaVerde,
};

function renderProfile(user: ProfileRead) {
  const auth = fakeAuth({ user });
  renderWithAuth(<MyProfile />, auth);
  return auth;
}

async function renderWithSession() {
  render(
    <AuthProvider>
      <MyProfile />
    </AuthProvider>,
  );
  await screen.findByLabelText("Nome completo");
}

async function replace(label: string, text: string) {
  const field = screen.getByLabelText(label);
  await userEvent.clear(field);
  await userEvent.type(field, text);
}

function save() {
  return userEvent.click(screen.getByRole("button", { name: "Salvar" }));
}

describe("MyProfile", () => {
  it("shows the building, block, unit and link status of a resident", () => {
    renderProfile(resident);

    expect(screen.getByText("Cond. Village Vila Verde, Bloco B, 42")).toBeInTheDocument();
    expect(screen.getByText("Morador Verificado")).toBeInTheDocument();
  });

  it("leaves the block out when the resident has none", () => {
    renderProfile(residentWithoutBlock);

    expect(screen.getByText("Cond. Village Vila Verde, 42")).toBeInTheDocument();
  });

  it("shows the farm of a farmer", () => {
    renderProfile(farmer);

    expect(screen.getByText("Sítio Boa Vista")).toBeInTheDocument();
    expect(screen.getByText("Agricultor")).toBeInTheDocument();
  });

  it("shows the building of a manager", () => {
    renderProfile(manager);

    expect(screen.getByText("Cond. Village Vila Verde")).toBeInTheDocument();
    expect(screen.getByText("Síndico")).toBeInTheDocument();
  });

  it("fills the form with the saved data and a read-only e-mail", () => {
    renderProfile(resident);

    expect(screen.getByLabelText("Nome completo")).toHaveValue("Ana Souza");
    expect(screen.getByLabelText("E-mail")).toHaveValue("ana@example.com");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("E-mail")).not.toBeRequired();
    expect(screen.getByLabelText("Celular")).toHaveValue("(11) 94002-8922");
    expect(screen.getByLabelText("Telefone Fixo (opcional)")).toHaveValue("(11) 4002-8922");
  });

  it("shows no farm or building fields to a resident", () => {
    renderProfile(resident);

    expect(screen.queryByRole("heading", { name: "Sítio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Prédio" })).not.toBeInTheDocument();
  });

  it("saves the name and phones of a resident", async () => {
    const updated: ProfileRead = {
      ...resident,
      name: "Ana Souza Lima",
      cellphone: "11944644502",
      homephone: null,
    };
    const fetchMock = stubFetch(jsonResponse(updated));
    const auth = renderProfile(resident);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    await replace("Nome completo", "Ana Souza Lima");
    await replace("Celular", "11944644502");
    await userEvent.clear(screen.getByLabelText("Telefone Fixo (opcional)"));
    await save();

    expect(await screen.findByText("Perfil atualizado")).toHaveRole("status");
    await expect(savedUser(auth)).resolves.toEqual(updated);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/profiles/me");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("PATCH");
    expect(sentBody(fetchMock, 0)).toEqual({
      name: "Ana Souza Lima",
      cellphone: "11944644502",
      homephone: null,
    });
  });

  it("saves the farm name and the CEP of a farmer", async () => {
    const fetchMock = stubFetch(jsonResponse(farmer));
    renderProfile(farmer);

    expect(screen.getByLabelText("Nome do sítio ou da horta")).toHaveValue("Sítio Boa Vista");
    expect(screen.getByLabelText("CEP do sítio")).toHaveValue("01310200");
    await replace("Nome do sítio ou da horta", "Horta da Ana");
    await replace("CEP do sítio", "01310-100");
    await save();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(sentBody(fetchMock, 0)).toEqual({
      name: "Ana Souza",
      cellphone: "(11) 94002-8922",
      homephone: "(11) 4002-8922",
      farm_name: "Horta da Ana",
      zip_code: "01310-100",
    });
  });

  it("saves the CNPJ and the CEP of a manager", async () => {
    const fetchMock = stubFetch(jsonResponse(manager));
    renderProfile(manager);

    expect(screen.getByLabelText("CNPJ do Prédio")).toHaveValue("50673649000144");
    expect(screen.getByLabelText("CEP do Prédio")).toHaveValue("09450000");
    await replace("CNPJ do Prédio", "60.701.190/0001-04");
    await replace("CEP do Prédio", "09450-001");
    await save();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(sentBody(fetchMock, 0)).toEqual({
      name: "Ana Souza",
      cellphone: "(11) 94002-8922",
      homephone: "(11) 4002-8922",
      building_cnpj: "60.701.190/0001-04",
      zip_code: "09450-001",
    });
  });

  it("shows the saved name in the card after saving", async () => {
    stubFetch(jsonResponse(resident), jsonResponse({ ...resident, name: "Ana Souza Lima" }));
    await renderWithSession();

    await replace("Nome completo", "Ana Souza Lima");
    await save();

    expect(await screen.findByText("Perfil atualizado")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza Lima")).toBeInTheDocument();
  });

  it("shows the API message when the profile cannot be saved", async () => {
    const detail = "Não foi possível localizar este CEP. Informe um CEP próximo";
    stubFetch(jsonResponse({ detail }, 422));
    renderProfile(farmer);

    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
    expect(screen.queryByText("Perfil atualizado")).not.toBeInTheDocument();
  });

  it("hides the saved message when the next save fails", async () => {
    const detail = "Muitas tentativas. Tente novamente mais tarde";
    stubFetch(jsonResponse(resident), jsonResponse({ detail }, 429));
    renderProfile(resident);
    await save();
    await screen.findByText("Perfil atualizado");

    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
    expect(screen.queryByText("Perfil atualizado")).not.toBeInTheDocument();
  });

  it("hides the saved message once the data changes again", async () => {
    stubFetch(jsonResponse(resident));
    renderProfile(resident);
    await save();
    await screen.findByText("Perfil atualizado");

    await userEvent.type(screen.getByLabelText("Nome completo"), " Lima");

    expect(screen.queryByText("Perfil atualizado")).not.toBeInTheDocument();
  });

  it("forgets the error on cancel", async () => {
    stubFetch(jsonResponse({ detail: "CEP não encontrado" }, 422));
    renderProfile(farmer);
    await save();
    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("undoes the edits on cancel", async () => {
    const fetchMock = stubFetch();
    renderProfile(resident);
    await replace("Nome completo", "Outro Nome");
    await replace("Celular", "11900000000");

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByLabelText("Nome completo")).toHaveValue("Ana Souza");
    expect(screen.getByLabelText("Celular")).toHaveValue("(11) 94002-8922");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancels back to the data saved last", async () => {
    stubFetch(jsonResponse(resident), jsonResponse({ ...resident, name: "Ana Souza Lima" }));
    await renderWithSession();
    await replace("Nome completo", "Ana Souza Lima");
    await save();
    await screen.findByText("Perfil atualizado");
    await replace("Nome completo", "Outro Nome");

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByLabelText("Nome completo")).toHaveValue("Ana Souza Lima");
  });

  it("locks the form while the profile is being saved", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    renderProfile(resident);

    await save();

    expect(screen.getByLabelText("Nome completo")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});
