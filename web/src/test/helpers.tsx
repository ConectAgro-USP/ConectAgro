import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import type { ApartmentMatch, ApartmentSummary, LinkStatus, ProfileRead } from "../api/profiles";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";

export const ana: ProfileRead = {
  name: "Ana Souza",
  email: "ana@example.com",
  profile_type: null,
  buyer: null,
};

export const villageVilaVerde: ApartmentSummary = {
  public_id: "6f1c2b9e-3d4a-4e5f-8a7b-9c0d1e2f3a4b",
  building_name: "Cond. Village Vila Verde",
  building_cnpj: "50673649000144",
  address: "Rua Quatro, 251 - Vila Verde, Rio Grande da Serra",
};

// como o prédio aparece na busca por CNPJ, que também mostra o síndico
export const villageVilaVerdeMatch: ApartmentMatch = {
  ...villageVilaVerde,
  manager_short_name: "Maria S.",
};

export function anaAsBuyer(linkStatus: LinkStatus): ProfileRead {
  const buyer = { block: "B", unit: "42", link_status: linkStatus, apartment: villageVilaVerde };
  return { ...ana, profile_type: "buyer", buyer };
}

export function fakeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const user = overrides.user ?? null;
  return {
    user,
    profileType: user?.profile_type ?? null,
    linkStatus: user?.buyer?.link_status ?? null,
    loading: false,
    sessionError: false,
    loginWithGoogle: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(undefined),
    saveProfile: vi.fn(async (request: Promise<ProfileRead>) => {
      await request;
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function renderWithAuth(ui: ReactNode, auth: AuthContextValue, url = "/") {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>
    </AuthContext.Provider>,
  );
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function sentBody(fetchMock: ReturnType<typeof stubFetch>, call: number): unknown {
  return JSON.parse(String(fetchMock.mock.calls[call][1]?.body));
}

export function savedUser(auth: AuthContextValue): Promise<ProfileRead> {
  return vi.mocked(auth.saveProfile).mock.calls[0][0];
}
