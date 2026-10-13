const BASE_URL = "/api";

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
    throw new ApiError(response.status, await response.text());
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
