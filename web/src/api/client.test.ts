import { jsonResponse, stubFetch } from "../test/helpers";
import { ApiError, apiFetch, errorMessage, lostAccess } from "./client";

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
    ["body", "rating", "Escolha uma nota de 1 a 5 estrelas"],
    ["body", "comment", "O comentário pode ter até 500 caracteres"],
  ])("explains the first %s field %s the API refused", async (place, field, message) => {
    const detail = [{ loc: [place, field], msg: "String should have at most 20 characters" }];
    stubFetch(jsonResponse({ detail }, 422));

    await expect(apiFetch("/profiles/farmer")).rejects.toMatchObject({ status: 422, message });
  });

  it("keeps the reason the API gave for an invalid character in the comment", async () => {
    const msg = "Value error, O texto tem um caractere inválido";
    stubFetch(jsonResponse({ detail: [{ loc: ["body", "comment"], msg }] }, 422));

    await expect(apiFetch("/reviews/avaliacao-1")).rejects.toMatchObject({
      status: 422,
      message: "O texto tem um caractere inválido",
    });
  });

  it("keeps the reason the API gave for a delivery date in the past", async () => {
    const msg = "Value error, A data prevista de entrega não pode estar no passado";
    stubFetch(jsonResponse({ detail: [{ loc: ["body", "expected_delivery_date"], msg }] }, 422));

    await expect(apiFetch("/purchases")).rejects.toMatchObject({
      status: 422,
      message: "A data prevista de entrega não pode estar no passado",
    });
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

describe("lostAccess", () => {
  it.each([401, 403])("is true when the API answers %i", (status) => {
    expect(lostAccess(new ApiError(status, "Sem acesso"))).toBe(true);
  });

  it("is false for other failures", () => {
    expect(lostAccess(new ApiError(404, "Não encontrado"))).toBe(false);
    expect(lostAccess(new TypeError("Failed to fetch"))).toBe(false);
  });
});
