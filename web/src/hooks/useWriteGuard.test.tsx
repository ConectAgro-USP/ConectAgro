import { renderHook } from "@testing-library/react";
import { ApiError } from "../api/client";
import { fakeAuth, withAuth } from "../test/helpers";
import { useWriteGuard } from "./useWriteGuard";

function renderGuard(auth = fakeAuth()) {
  const { result } = renderHook(() => useWriteGuard(), { wrapper: withAuth(auth) });
  return { guard: result.current, auth };
}

describe("useWriteGuard", () => {
  it("returns what the request resolves to, without reloading the user", async () => {
    const { guard, auth } = renderGuard();

    await expect(guard(Promise.resolve("salvo"))).resolves.toBe("salvo");
    expect(auth.refreshUser).not.toHaveBeenCalled();
  });

  it.each([401, 403])("reloads the user on %i and keeps the error", async (status) => {
    const { guard, auth } = renderGuard();
    const refusal = new ApiError(status, "Não autenticado");

    await expect(guard(Promise.reject(refusal))).rejects.toBe(refusal);
    expect(auth.refreshUser).toHaveBeenCalledOnce();
  });

  it("keeps the error when the user can't be reloaded", async () => {
    const refreshUser = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { guard } = renderGuard(fakeAuth({ refreshUser }));
    const refusal = new ApiError(401, "Não autenticado");

    await expect(guard(Promise.reject(refusal))).rejects.toBe(refusal);
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it.each([404, 409, 500])("leaves the user alone on %i", async (status) => {
    const { guard, auth } = renderGuard();
    const refusal = new ApiError(status, "Recusado");

    await expect(guard(Promise.reject(refusal))).rejects.toBe(refusal);
    expect(auth.refreshUser).not.toHaveBeenCalled();
  });
});
