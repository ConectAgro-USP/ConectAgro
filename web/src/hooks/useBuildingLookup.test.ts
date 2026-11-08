import { act, renderHook, waitFor } from "@testing-library/react";
import { ApiError } from "../api/client";
import { fakeAuth, withAuth } from "../test/helpers";
import { useBuildingLookup } from "./useBuildingLookup";

const FIRST_CNPJ = "00.000.000/0001-91";
const SECOND_CNPJ = "60.701.190/0001-04";

function renderLookup<Found>(
  find: (cnpj: string) => Promise<Found>,
  initialCnpj?: string,
  auth = fakeAuth(),
) {
  return renderHook(() => useBuildingLookup(find, initialCnpj), { wrapper: withAuth(auth) });
}

describe("useBuildingLookup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ignores the answer of a CNPJ that was replaced", async () => {
    let answerFirst: (name: string) => void = () => {};
    const find = vi.fn((cnpj: string) => {
      if (cnpj === FIRST_CNPJ) {
        return new Promise<string>((resolve) => {
          answerFirst = resolve;
        });
      }
      return Promise.resolve("Edifício Bauru");
    });
    const { result } = renderLookup(find);

    act(() => result.current.changeCnpj(FIRST_CNPJ));
    expect(result.current.searching).toBe(true);
    act(() => result.current.changeCnpj(SECOND_CNPJ));
    await waitFor(() => expect(result.current.found).toBe("Edifício Bauru"));
    await act(async () => answerFirst("Edifício Araraquara"));

    expect(result.current.found).toBe("Edifício Bauru");
    expect(result.current.searching).toBe(false);
  });

  it("searches for a CNPJ with letters", async () => {
    const find = vi.fn().mockResolvedValue("Edifício Novo");

    const { result } = renderLookup(find, "12.ABC.345/01DE-35");

    await waitFor(() => expect(result.current.found).toBe("Edifício Novo"));
    expect(find).toHaveBeenCalledWith("12.ABC.345/01DE-35");
  });

  it("forgets the building when the CNPJ changes", async () => {
    const find = vi.fn().mockResolvedValue("Edifício Bauru");
    const { result } = renderLookup(find, SECOND_CNPJ);
    await waitFor(() => expect(result.current.found).toBe("Edifício Bauru"));

    act(() => result.current.changeCnpj("60.701.190/0001-0"));

    expect(result.current.found).toBeNull();
    expect(result.current.searching).toBe(false);
  });

  it("asks to check an incomplete CNPJ when the building is required", () => {
    const find = vi.fn();
    const { result } = renderLookup(find, "60.701.190");

    let found: unknown;
    act(() => {
      found = result.current.requireFound();
    });

    expect(found).toBeNull();
    expect(result.current.error).toBe("Confira o CNPJ do prédio");
    expect(find).not.toHaveBeenCalled();
  });

  it("does not search again when the API refused the CNPJ", async () => {
    const find = vi.fn().mockRejectedValue(new ApiError(422, "CNPJ não encontrado"));
    const { result } = renderLookup(find, SECOND_CNPJ);
    await waitFor(() => expect(result.current.error).toBe("CNPJ não encontrado"));

    act(() => {
      result.current.requireFound();
    });

    expect(result.current.error).toBe("CNPJ não encontrado");
    expect(find).toHaveBeenCalledOnce();
  });

  it("searches again when the building is required after a failure", async () => {
    const find = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, "Tente mais tarde"))
      .mockResolvedValueOnce("Edifício Bauru");
    const { result } = renderLookup(find, SECOND_CNPJ);
    await waitFor(() => expect(result.current.error).toBe("Tente mais tarde"));

    act(() => {
      result.current.requireFound();
    });

    await waitFor(() => expect(result.current.found).toBe("Edifício Bauru"));
    expect(find).toHaveBeenCalledTimes(2);
  });

  it("reloads the session when the API says it ended", async () => {
    const auth = fakeAuth();
    const find = vi.fn().mockRejectedValue(new ApiError(401, "Sessão inválida ou expirada"));

    const { result } = renderLookup(find, SECOND_CNPJ, auth);

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
    expect(result.current.error).toBe("Sessão inválida ou expirada");
  });

  it("keeps the message when the ended session cannot be reloaded", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const refreshUser = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const find = vi.fn().mockRejectedValue(new ApiError(401, "Sessão inválida ou expirada"));

    const { result } = renderLookup(find, SECOND_CNPJ, fakeAuth({ refreshUser }));

    await waitFor(() => expect(consoleError).toHaveBeenCalledOnce());
    expect(result.current.error).toBe("Sessão inválida ou expirada");
  });

  it("does not reload the session for other failures", async () => {
    const auth = fakeAuth();
    const find = vi.fn().mockRejectedValue(new ApiError(503, "Tente mais tarde"));

    const { result } = renderLookup(find, SECOND_CNPJ, auth);

    await waitFor(() => expect(result.current.error).toBe("Tente mais tarde"));
    expect(auth.refreshUser).not.toHaveBeenCalled();
  });
});
