import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReceivedReview } from "../api/reviews";
import { jsonResponse, stubFetch } from "../test/helpers";
import { managerContact, pageLoad, renderDetail, sampleProduct } from "../test/productDetail";

const HEADING = "Avaliações com comentário";

function review(day: number, rating: number, comment: string): ReceivedReview {
  return {
    public_id: `avaliacao-${day}`,
    rating,
    comment,
    created_at: `2026-11-${String(day).padStart(2, "0")}T15:00:00Z`,
    updated_at: null,
  };
}

// a API manda da mais nova para a mais antiga
const reviews = [
  review(20, 5, "Entregou no dia combinado"),
  review(18, 4, ""),
  review(15, 3, "Atrasou um pouco, mas avisou"),
  review(12, 5, "Mandioca fresquinha"),
  review(10, 2, "Veio pouca"),
  review(8, 4, "   "),
  review(5, 5, "Muito bom"),
];

function renderReviews(list: ReceivedReview[]) {
  const summary = { average_rating: 4, reviews_count: list.length, reviews: list };
  stubFetch(...pageLoad(sampleProduct, summary));
  renderDetail();
}

async function findSection(): Promise<HTMLElement> {
  return (await screen.findByRole("heading", { name: HEADING })).closest("section")!;
}

describe("ProductDetail, farmer reviews", () => {
  it("shows the three most recent written reviews under the seller", async () => {
    renderReviews(reviews);

    const section = await findSection();
    const items = within(section).getAllByRole("listitem");

    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Entregou no dia combinado");
    expect(items[1]).toHaveTextContent("Atrasou um pouco, mas avisou");
    expect(items[2]).toHaveTextContent("Mandioca fresquinha");
    expect(section).not.toHaveTextContent("Veio pouca");
    const seller = screen.getByText("Vendido por").parentElement!.parentElement!;
    expect(seller).toContainElement(section);
  });

  it("shows only the stars, the date and the comment of each review", async () => {
    renderReviews(reviews);

    const [first, second] = within(await findSection()).getAllByRole("listitem");

    expect(first).toHaveTextContent(/^Nota 5 de 5 ?20\/11\/2026 ?Entregou no dia combinado$/);
    expect(second).toHaveTextContent(/^Nota 3 de 5 ?15\/11\/2026 ?Atrasou um pouco, mas avisou$/);
  });

  it("expands the rest in place with Ver todas and folds it back", async () => {
    const user = userEvent.setup();
    renderReviews(reviews);
    const section = await findSection();
    const toggle = within(section).getByRole("button", { name: "Ver todas" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[3]).toHaveTextContent(/Nota 2 de 5 ?10\/11\/2026 ?Veio pouca/);
    expect(items[4]).toHaveTextContent("Muito bom");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Ver menos");

    await user.click(toggle);

    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
    expect(toggle).toHaveAccessibleName("Ver todas");
  });

  it("offers no Ver todas with three written reviews or fewer", async () => {
    renderReviews(reviews.slice(0, 4));

    const section = await findSection();

    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
    expect(within(section).queryByRole("button")).not.toBeInTheDocument();
  });

  it("leaves the list out when no review has a comment", async () => {
    renderReviews([review(20, 5, ""), review(18, 3, "  ")]);

    expect(await screen.findByText("(2 avaliações)")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: HEADING })).not.toBeInTheDocument();
  });

  it("says when the reviews could not load", async () => {
    const failure = jsonResponse({ detail: "Algo deu errado no servidor" }, 500);
    stubFetch(jsonResponse(sampleProduct), jsonResponse(managerContact), failure);
    renderDetail();

    expect(await screen.findByText("Avaliações indisponíveis")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: HEADING })).not.toBeInTheDocument();
  });
});
