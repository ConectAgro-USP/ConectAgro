import { startTransition, useEffect, useId } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useNavigationType,
  useSearchParams,
} from "react-router";
import {
  createReview,
  RATINGS,
  updateReview,
  type AuthoredReview,
  type Reviewable,
} from "../api/reviews";
import { SecondaryButton } from "../components/Button";
import { CARD_SURFACE } from "../components/surface";
import { FormError } from "../components/FormError";
import { ShowMore, type PagedList } from "../components/ShowMore";
import { TitleBar } from "../components/TitleBar";
import { FarmerAvatar } from "../components/reviews/FarmerAvatar";
import {
  editReviewPath,
  FROM_APP,
  REVIEWS_PATH,
  reviewsStateOf,
} from "../components/reviews/paths";
import { RateLinks } from "../components/reviews/RateLinks";
import { ReviewForm } from "../components/reviews/ReviewForm";
import { RatingStars } from "../components/reviews/StarRating";
import { farmerName, formatDay, formatFullDay, formatNames } from "../format";
import { useAuthorReviews } from "../hooks/useAuthorReviews";

const SENT = "Avaliação enviada. Obrigado por ajudar outros prédios a escolher!";
const EDITED = "Avaliação atualizada.";
const BACK_TO_LIST = { to: REVIEWS_PATH, label: "Voltar às avaliações" };
const LINK_BUTTON_CLASSES =
  "inline-flex h-11 items-center rounded-full border border-stone-400 bg-white px-5 " +
  "font-bold hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-lime-800";
const CARD_CLASSES = `px-6 py-6 sm:px-10 ${CARD_SURFACE}`;
const NOT_WAITING = "Esta entrega não está esperando sua avaliação. Ela pode já ter sido avaliada.";
const NOT_FOUND = "Não encontramos esta avaliação entre as suas.";

type View =
  | { kind: "list" }
  | { kind: "create"; purchase: string; farmer: string; rating: number }
  | { kind: "edit"; review: string };

const TITLES: Record<View["kind"], string> = {
  list: "Avaliações",
  create: "Avaliar agricultor",
  edit: "Editar avaliação",
};

function ratingOf(text: string | null): number {
  const rating = Number(text);
  return RATINGS.includes(rating) ? rating : 0;
}

function viewOf(params: URLSearchParams): View {
  const review = params.get("editar");
  if (review) {
    return { kind: "edit", review };
  }
  const purchase = params.get("compra");
  const farmer = params.get("agricultor");
  if (purchase && farmer) {
    return { kind: "create", purchase, farmer, rating: ratingOf(params.get("nota")) };
  }
  return { kind: "list" };
}

function deliveryContext(reviewable: Reviewable): string {
  const parts = [];
  if (reviewable.delivered_at) {
    parts.push(`Entregue em ${formatDay(reviewable.delivered_at)}`);
  }
  if (reviewable.product_names.length > 0) {
    parts.push(formatNames(reviewable.product_names));
  }
  return parts.join(" · ") || "Sua compra foi entregue";
}

function PendingCard({ reviewable }: Readonly<{ reviewable: Reviewable }>) {
  const name = farmerName(reviewable);
  return (
    <li className={CARD_CLASSES}>
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-5">
          <FarmerAvatar name={name} />
          <div className="min-w-0">
            <h3 className="text-2xl sm:text-3xl">{name}</h3>
            <p className="line-clamp-2 text-stone-600">{formatNames(reviewable.product_names)}</p>
          </div>
        </div>
        {reviewable.delivered_at && (
          <p className="text-lg">
            Entregue em <span className="tabular-nums">{formatDay(reviewable.delivered_at)}</span>
          </p>
        )}
      </div>
      <div className="mt-4">
        <RateLinks reviewable={reviewable} />
      </div>
    </li>
  );
}

function AuthoredCard({ review }: Readonly<{ review: AuthoredReview }>) {
  const nameId = useId();
  const dateId = useId();
  const name = farmerName(review);

  return (
    <li className={CARD_CLASSES}>
      <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-4">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-5">
          <FarmerAvatar name={name} />
          <div className="min-w-0 space-y-1">
            <h3 id={nameId} className="text-2xl sm:text-3xl">
              {name}
            </h3>
            <RatingStars rating={review.rating} label={`Nota ${review.rating} de 5`} />
          </div>
        </div>
        <Link
          to={editReviewPath(review)}
          state={FROM_APP}
          aria-describedby={`${nameId} ${dateId}`}
          className={LINK_BUTTON_CLASSES}
        >
          Editar
        </Link>
      </div>
      {review.comment && (
        <p className="mt-4 text-lg break-words whitespace-pre-line">{review.comment}</p>
      )}
      <p id={dateId} className="mt-3 text-sm font-bold text-stone-500">
        Feita em <span className="tabular-nums">{formatFullDay(review.created_at)}</span>
        {review.updated_at && (
          <>
            {" "}
            · editada em <span className="tabular-nums">{formatFullDay(review.updated_at)}</span>
          </>
        )}
      </p>
    </li>
  );
}

interface ListsProps {
  reviewables: Reviewable[];
  authored: AuthoredReview[];
  pendingPages: PagedList;
  authoredPages: PagedList;
}

const MORE_CLASSES = "mt-6";

function ReviewLists({
  reviewables,
  authored,
  pendingPages,
  authoredPages,
}: Readonly<ListsProps>) {
  const pendingId = useId();
  const authoredId = useId();

  return (
    <>
      <section className="pt-8">
        <h2 id={pendingId} className="text-3xl font-bold">
          Avaliações pendentes
        </h2>
        {reviewables.length === 0 ? (
          <p className="mt-4 text-lg text-stone-600">
            Nenhuma entrega esperando sua avaliação. Quando um agricultor entregar uma compra do
            prédio, ela aparecerá aqui.
          </p>
        ) : (
          <ul aria-labelledby={pendingId} className="mt-6 space-y-6">
            {reviewables.map((reviewable) => (
              <PendingCard
                key={`${reviewable.purchase_public_id}/${reviewable.farmer_public_id}`}
                reviewable={reviewable}
              />
            ))}
          </ul>
        )}
        <ShowMore list={pendingPages} label="Mostrar mais entregas" className={MORE_CLASSES} />
      </section>
      <section className="pt-12">
        <h2 id={authoredId} className="text-3xl font-bold">
          Suas avaliações
        </h2>
        {authored.length === 0 ? (
          <p className="mt-4 text-lg text-stone-600">Você ainda não avaliou nenhuma entrega.</p>
        ) : (
          <ul aria-labelledby={authoredId} className="mt-6 space-y-6">
            {authored.map((review) => (
              <AuthoredCard key={review.public_id} review={review} />
            ))}
          </ul>
        )}
        <ShowMore list={authoredPages} label="Mostrar mais avaliações" className={MORE_CLASSES} />
      </section>
    </>
  );
}

function Unavailable({ message }: Readonly<{ message: string }>) {
  return (
    <div className="space-y-6 pt-8">
      <p className="text-xl">{message}</p>
      <Link to={REVIEWS_PATH} className={LINK_BUTTON_CLASSES}>
        Ver avaliações
      </Link>
    </div>
  );
}

export function Reviews() {
  const reviews = useAuthorReviews();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const view = viewOf(params);
  const { fromApp, message = "" } = reviewsStateOf(location.state);
  const reviewable =
    view.kind === "create"
      ? reviews.reviewables.find(
          (item) =>
            item.purchase_public_id === view.purchase && item.farmer_public_id === view.farmer,
        )
      : undefined;
  const review =
    view.kind === "edit"
      ? reviews.authored.find((item) => item.public_id === view.review)
      : undefined;
  // o link pode levar a um item de outra página, que é buscada até achar
  let searched: PagedList | null = null;
  if (view.kind === "create" && !reviewable) searched = reviews.pendingPages;
  if (view.kind === "edit" && !review) searched = reviews.authoredPages;
  const searching = reviews.loaded && searched !== null && searched.hasMore && !searched.error;

  useEffect(() => {
    if (searching && searched && !searched.loading) searched.loadMore();
  });

  function leave() {
    if (fromApp) {
      void navigate(-1);
    } else {
      void navigate(REVIEWS_PATH, { replace: true });
    }
  }

  function finish(sent: string) {
    void navigate(REVIEWS_PATH, { replace: true, state: { message: sent } });
  }

  async function send(save: () => Promise<void>) {
    try {
      await save();
    } catch (sendError) {
      reviews.reload();
      throw sendError;
    }
  }

  function content() {
    if (!reviews.loaded || searching) {
      return null;
    }
    if (view.kind === "create") {
      if (!reviewable) {
        return <Unavailable message={NOT_WAITING} />;
      }
      return (
        <ReviewForm
          key={location.key}
          farmerName={farmerName(reviewable)}
          context={deliveryContext(reviewable)}
          initial={{ rating: view.rating, comment: "" }}
          onSubmit={(values) =>
            send(async () => {
              const created = await createReview(reviewable, values);
              startTransition(() => {
                reviews.markReviewed(reviewable, created);
                finish(SENT);
              });
            })
          }
          onCancel={leave}
        />
      );
    }
    if (view.kind === "edit") {
      if (!review) {
        return <Unavailable message={NOT_FOUND} />;
      }
      return (
        <ReviewForm
          key={location.key}
          farmerName={farmerName(review)}
          context={`Avaliação feita em ${formatFullDay(review.created_at)}`}
          initial={{ rating: review.rating, comment: review.comment }}
          editing
          onSubmit={(values) =>
            send(async () => {
              reviews.markEdited(await updateReview(review.public_id, values));
              finish(EDITED);
            })
          }
          onCancel={leave}
        />
      );
    }
    return (
      <ReviewLists
        reviewables={reviews.reviewables}
        authored={reviews.authored}
        pendingPages={reviews.pendingPages}
        authoredPages={reviews.authoredPages}
      />
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <TitleBar title={TITLES[view.kind]} back={view.kind === "list" ? undefined : BACK_TO_LIST} />
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        <output className="block text-lg text-stone-600">
          {reviews.loading || searching ? "Carregando..." : ""}
        </output>
        <output className="block text-lg font-bold text-lime-800">
          {view.kind === "list" && navigationType !== "POP" ? message : ""}
        </output>
        {reviews.error && (view.kind === "list" || !reviews.loaded) && (
          <div className="space-y-4 pt-4">
            <FormError message={reviews.error} />
            <SecondaryButton onClick={reviews.reload}>Tentar de novo</SecondaryButton>
          </div>
        )}
        {content()}
      </div>
    </main>
  );
}
