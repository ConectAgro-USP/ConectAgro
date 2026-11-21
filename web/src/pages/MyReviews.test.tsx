import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReceivedReview, ReceivedReviews } from "../api/reviews";
import { anaAsFarmer, fakeAuth, jsonResponse, renderWithAuth, stubFetch } from "../test/helpers";
import { MyReviews } from "./MyReviews";

const praised: ReceivedReview = {
  public_id: "avaliacao-1",
  rating: 5,
  comment: "Mandioca de qualidade.",
  created_at: "2026-10-20T14:00:00Z",
  updated_at: null,
};

// ainda é 31 de dezembro de 2025 em Brasília
const silent: ReceivedReview = {
  public_id: "avaliacao-2",
  rating: 4,
  comment: "",
  created_at: "2026-01-01T02:00:00Z",
  updated_at: null,
};

function received(...reviews: ReceivedReview[]): ReceivedReviews {
  const sum = reviews.reduce((total, review) => total + review.rating, 0);
  const average = reviews.length === 0 ? null : Number((sum / reviews.length).toFixed(2));
  return { average_rating: average, reviews_count: reviews.length, reviews };
}

function renderReviews(...responses: Response[]) {
  const fetchMock = stubFetch(...responses);
  const auth = fakeAuth({ user: anaAsFarmer });
  renderWithAuth(<MyReviews />, auth);
  return { fetchMock, auth };
}

async function findCards(): Promise<HTMLElement[]> {
  return screen.findAllByRole("listitem");
}

describe("MyReviews", () => {
  it("asks the API for the reviews of the farmer", async () => {
    const { fetchMock } = renderReviews(jsonResponse(received(praised)));

    await findCards();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/farmers/me/reviews", expect.anything());
  });

  it("shows the average and how many reviews the farmer has", async () => {
    renderReviews(jsonResponse(received(praised, silent)));

    await findCards();
    expect(screen.getByText(/Nota média/).parentElement).toHaveTextContent(
      /^Nota média\s*4,5\s*de 5\s*2 avaliações$/,
    );
  });

  it("counts a single review", async () => {
    renderReviews(jsonResponse(received(praised)));

    expect(await screen.findByText("1 avaliação")).toBeVisible();
  });

  it("shows the stars, the comment and the date of each review, newest first", async () => {
    renderReviews(jsonResponse(received(praised, silent)));

    const [first, second] = await findCards();
    expect(within(first).getByText("Nota 5 de 5")).toBeInTheDocument();
    expect(within(first).getByText("Mandioca de qualidade.")).toBeVisible();
    expect(first).toHaveTextContent(/Feita em\s*20\/10\/2026/);
    expect(within(second).getByText("Nota 4 de 5")).toBeInTheDocument();
  });

  it("shows a review without comment with only the stars and the date", async () => {
    renderReviews(jsonResponse(received(silent)));

    const [card] = await findCards();
    expect(card).toHaveTextContent(/^Nota 4 de 5\s*Feita em\s*31\/12\/2025$/);
  });

  it("only shows the reviews, with nothing to change them", async () => {
    renderReviews(jsonResponse(received(praised, silent)));

    await findCards();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("explains where the reviews come from when there is none", async () => {
    renderReviews(jsonResponse(received()));

    expect(await screen.findByText(/Você ainda não recebeu avaliações/)).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/Nota média/)).not.toBeInTheDocument();
  });

  it("says it is loading until the reviews arrive", async () => {
    renderReviews(jsonResponse(received(praised)));

    expect(screen.getByRole("status")).toHaveTextContent("Carregando...");
    await findCards();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows the error and tries again", async () => {
    const { fetchMock } = renderReviews(
      jsonResponse({}, 500),
      jsonResponse(received(praised)),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Algo deu errado");
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await findCards()).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reloads the user when the session ended", async () => {
    const { auth } = renderReviews(jsonResponse({ detail: "Não autenticado" }, 401));

    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledOnce());
  });
});
