import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import App from "../App";
import type { ProfileRead } from "../api/profiles";
import type { AuthContextValue } from "../auth/AuthContext";
import { AuthProvider } from "../auth/AuthProvider";
import { feijao } from "./catalog";
import { pageOf } from "./farmers";
import { fakeAuth, jsonResponse, renderWithAuth } from "./helpers";
import { emptyReviews, sampleProduct } from "./productDetail";
import { Address } from "./RouterProbe";

// as rotas que a API abre para quem não entrou
const OPEN_ROUTES = [
  /^\/api\/products(\?|$)/,
  /^\/api\/products\/(?!me$)[^/?]+$/,
  /^\/api\/farmers\/(?!me\/)[^/]+\/reviews/,
];

export interface VisitorAnswers {
  catalog?: Response[];
  product?: unknown;
  reviews?: unknown;
}

function isOpen(url: string): boolean {
  return OPEN_ROUTES.some((route) => route.test(url));
}

// o visitante só fala com as rotas abertas, as outras respondem 401
function visitorFetch(answers: VisitorAnswers = {}) {
  const catalog = [...(answers.catalog ?? [])];
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (!isOpen(url)) return jsonResponse({ detail: "Não autenticado" }, 401);
    if (url.includes("/reviews")) return jsonResponse(answers.reviews ?? emptyReviews);
    if (url.startsWith("/api/products?")) return catalog.shift() ?? pageOf([feijao]);
    return jsonResponse(answers.product ?? sampleProduct);
  });
}

export function stubVisitorApi(answers: VisitorAnswers = {}) {
  const fetchMock = visitorFetch(answers);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function closedCalls(fetchMock: ReturnType<typeof stubVisitorApi>): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => !isOpen(url));
}

export function renderVisitorApp(
  url = "/",
  answers: VisitorAnswers = {},
  auth: AuthContextValue = fakeAuth(),
) {
  const fetchMock = stubVisitorApi(answers);
  const view = renderWithAuth(
    <>
      <App />
      <Address />
    </>,
    auth,
    url,
  );
  return Object.assign(view, { fetchMock, auth });
}

// a sessão abre e fecha pelo AuthProvider, como no navegador
export function renderSessionApp(url: string, initialUser: ProfileRead | null) {
  let user = initialUser;
  const visitorApi = visitorFetch();
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input, init) => {
      const path = String(input);
      if (path === "/api/auth/logout") {
        user = null;
        return jsonResponse({ message: "Logout realizado com sucesso" });
      }
      if (path === "/api/profiles/me" && user) return jsonResponse(user);
      return visitorApi(input, init);
    }),
  );
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[url]}>
        <App />
        <Address />
      </MemoryRouter>
    </AuthProvider>,
  );
}
