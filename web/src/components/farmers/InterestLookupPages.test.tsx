import { screen } from "@testing-library/react";
import type { Interest } from "../../api/interests";
import { Dashboard } from "../../pages/Dashboard";
import { feijao } from "../../test/catalog";
import { pageOf } from "../../test/farmers";
import { anaAsBuyer, fakeAuth, renderWithAuth, stubFetch } from "../../test/helpers";
import {
  answerMyInterests,
  interestsResponse,
  mandioca as interest,
} from "../../test/interests";
import { pageLoad, renderDetail } from "../../test/productDetail";
import { openInterest } from "../../test/productInterest";

const resident = fakeAuth({ user: anaAsBuyer("APROVADO") });

function chosen(productPublicId: string): Interest {
  return { ...interest, public_id: productPublicId, product_public_id: productPublicId };
}

// cem interesses por página, e o do produto só aparece na segunda
function twoPages(last: Interest): Response[] {
  return [
    interestsResponse([chosen("outro-1")], { total: 101, total_pages: 2, page_size: 100 }),
    interestsResponse([last], { page: 2, total: 101, total_pages: 2, page_size: 100 }),
  ];
}

describe("the resident's interest, past the first page", () => {
  it("marks a catalog product whose interest is on the second page", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => pageOf([feijao])));
    const listed = answerMyInterests(...twoPages({ ...chosen("produto-1"), quantity: 3 }));
    renderWithAuth(<Dashboard />, resident);

    const row = (await screen.findByRole("heading", { level: 3, name: "Feijão carioca" }))
      .closest("li")!;

    expect(row).toHaveTextContent("No seu interesse: 3 kg");
    expect(listed.mock.calls.map(([url]) => url)).toEqual([
      "/api/interests/me?page=1&page_size=100",
      "/api/interests/me?page=2&page_size=100",
    ]);
  });

  it("asks the product page only for the interest of its product", async () => {
    stubFetch(...pageLoad());
    const others = Array.from({ length: 30 }, (_, index) => chosen(`outro-${index}`));
    const { listed } = renderDetail(undefined, undefined, [...others, openInterest]);

    expect(await screen.findByText("No seu interesse: 5 kg")).toBeInTheDocument();
    expect(listed).toHaveBeenCalledExactlyOnceWith(
      "/api/interests/me?page=1&product_public_id=prod-123",
    );
  });

  it("offers to register when the product has no interest of the resident", async () => {
    stubFetch(...pageLoad());
    renderDetail(undefined, undefined, [chosen("outro-1")]);

    expect(await screen.findByRole("button", { name: "Registrar interesse" })).toBeEnabled();
    expect(screen.queryByText(/No seu interesse/)).not.toBeInTheDocument();
  });
});
