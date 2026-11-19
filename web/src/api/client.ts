const BASE_URL = "/api";
const UNEXPECTED_ERROR = "Algo deu errado. Tente novamente";
const CONNECTION_ERROR = "Não foi possível falar com o servidor. Tente novamente";

// a lista de erros do 422 vem do Pydantic, em inglês; a tela mostra estes
const INVALID_FIELD_MESSAGES = new Map([
  ["name", "Informe seu nome completo, com 2 a 100 caracteres"],
  ["email", "Informe um e-mail válido"],
  ["password", "A senha precisa ter de 8 a 128 caracteres"],
  ["cpf", "CPF inválido"],
  ["cellphone", "Celular inválido. Informe o DDD e o número"],
  ["homephone", "Telefone fixo inválido. Informe o DDD e o número"],
  ["farm_name", "Informe o nome do sítio ou da horta, com 2 a 150 caracteres"],
  ["zip_code", "CEP inválido"],
  ["cnpj", "CNPJ inválido"],
  ["building_cnpj", "CNPJ inválido"],
  ["block", "O bloco pode ter até 10 caracteres"],
  ["unit", "Informe o número do apartamento, com até 10 caracteres"],
  ["quantity", "A quantidade deve ser um número não negativo"],
  ["price", "O preço deve ser não negativo e ter até 2 casas decimais"],
  ["expiration_date", "Informe uma data de validade válida"],
  ["picture_url", "Informe uma URL de imagem válida"],
]);

interface InvalidField {
  loc: (string | number)[];
  msg?: string;
}

interface ErrorBody {
  detail?: string | InvalidField[];
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function jsonHeaders({ body, headers }: RequestInit): Headers {
  const merged = new Headers(headers);
  if (typeof body === "string" && !merged.has("Content-Type")) {
    merged.set("Content-Type", "application/json");
  }
  return merged;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: jsonHeaders(options),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response, path));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response, path: string): Promise<string> {
  let detail: string | InvalidField[] | undefined;
  try {
    const body: ErrorBody = await response.json();
    detail = body.detail;
  } catch {
    return UNEXPECTED_ERROR;
  }

  if (typeof detail === "string") {
    return detail;
  }
  if (!Array.isArray(detail) || detail.length === 0) {
    return UNEXPECTED_ERROR;
  }
  const invalidField = detail[0];
  const field = String(invalidField.loc.at(-1));
  if (field === "name" && (path === "/products" || path.startsWith("/products/"))) {
    return "Informe o nome do produto, com até 100 caracteres";
  }
  if (
    field === "expiration_date" &&
    invalidField.msg?.includes("Não é possível cadastrar produto vencido")
  ) {
    return invalidField.msg.replace(/^Value error,\s*/, "");
  }
  if (
    field === "expiration_date" &&
    invalidField.msg?.includes("Atualização faz com que o produto esteja fora da validade")
  ) {
    return invalidField.msg.replace(/^Value error,\s*/, "");
  }
  return INVALID_FIELD_MESSAGES.get(field) ?? UNEXPECTED_ERROR;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return CONNECTION_ERROR;
}

// 401 é sessão encerrada e 403 é outro perfil, nos dois a tela não serve mais
export function lostAccess(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}
