import { jsonResponse, stubFetch } from "../test/helpers";
import { ApiError, apiFetch, errorMessage } from "./client";

describe("apiFetch", () => {
  it("sends JSON with the session cookie and returns the body", async () => {
    const fetchMock = stubFetch(jsonResponse({ ok: true }));

    const body = await apiFetch("/profiles/me", { method: "POST", body: "{}" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(body).toEqual({ ok: true });
    expect(url).toBe("/api/profiles/me");
    expect(options?.credentials).toBe("include");
    expect(new Headers(options?.headers).get("Content-Type")).toBe("application/json");
  });

  it("returns nothing for 204", async () => {
    stubFetch(new Response(null, { status: 204 }));

    await expect(apiFetch("/auth/logout")).resolves.toBeUndefined();
  });

  it("keeps the message the API wrote", async () => {
    stubFetch(jsonResponse({ detail: "E-mail ou senha incorretos" }, 401));

    await expect(apiFetch("/auth/login")).rejects.toMatchObject({
      status: 401,
      message: "E-mail ou senha incorretos",
    });
  });

  it.each([
    ["body", "cpf", "CPF inválido"],
    ["query", "cnpj", "CNPJ inválido"],
    ["body", "building_cnpj", "CNPJ inválido"],
  ])("explains the first %s field %s the API refused", async (place, field, message) => {
    const detail = [{ loc: [place, field], msg: "String should have at most 20 characters" }];
    stubFetch(jsonResponse({ detail }, 422));

    await expect(apiFetch("/profiles/farmer")).rejects.toMatchObject({ status: 422, message });
  });

  it.each([
    ["an unknown field", jsonResponse({ detail: [{ loc: ["query", "page"] }] }, 422)],
    ["an empty list of fields", jsonResponse({ detail: [] }, 422)],
    ["an error page", new Response("<html>Bad Gateway</html>", { status: 502 })],
  ])("uses a generic message for %s", async (_case, response) => {
    stubFetch(response);

    await expect(apiFetch("/profiles/me")).rejects.toMatchObject({
      message: "Algo deu errado. Tente novamente",
    });
  });
});

describe("errorMessage", () => {
  it("shows the message of an API error", () => {
    expect(errorMessage(new ApiError(409, "CPF já cadastrado"))).toBe("CPF já cadastrado");
  });

  it("asks to try again when the server cannot be reached", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toBe(
      "Não foi possível falar com o servidor. Tente novamente",
    );
  });
});
