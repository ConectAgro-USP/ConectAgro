import { PlusIcon, SproutIcon } from "lucide-react";
import { Link } from "react-router";
import { NO_FILTERS } from "../api/history";
import { countMyProducts } from "../api/products";
import { listReceivedReviews } from "../api/reviews";
import { listSales } from "../api/sales";
import { useAuth } from "../auth/AuthContext";
import { CARD_SURFACE } from "../components/surface";
import { TitleBar } from "../components/TitleBar";
import { useLoaded } from "../hooks/useLoaded";
import { ProductsSummary, RatingSummary, SalesSummary } from "./home/Summaries";
import { SummaryCard } from "./home/SummaryCard";

const NEW_PRODUCT_PATH = "/meus-produtos?novo=1";
const ADD_CLASSES =
  "inline-flex h-14 items-center justify-center gap-2 rounded-full bg-lime-800 px-8 " +
  "font-bold text-white hover:bg-lime-900 focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-lime-800";

function listSalesToDeliver() {
  return listSales({ ...NO_FILTERS, status: "EM PROGRESSO" }, 1);
}

function FirstProduct() {
  return (
    <section className={`flex flex-col items-center gap-4 px-6 py-10 text-center ${CARD_SURFACE}`}>
      <SproutIcon aria-hidden="true" className="size-12 text-lime-800" />
      <h2 className="text-2xl font-bold sm:text-3xl">Seus produtos aparecem aqui</h2>
      <p className="max-w-prose text-lg text-stone-700">
        Cadastre o que você colhe para os prédios da região verem e comprarem.
      </p>
      <Link to={NEW_PRODUCT_PATH} className={ADD_CLASSES}>
        <PlusIcon aria-hidden="true" className="size-6" />
        Cadastrar primeiro produto
      </Link>
    </section>
  );
}

export function FarmerHome() {
  const { user } = useAuth();
  const sales = useLoaded(listSalesToDeliver);
  const products = useLoaded(countMyProducts);
  const reviews = useLoaded(listReceivedReviews);
  const firstName = user?.name.trim().split(/\s+/)[0] ?? "";
  const noProducts = products.data?.all === 0;
  const hasSales = (sales.data?.total ?? 0) > 0;

  return (
    <main className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <TitleBar title="Início" />
      <div className="mx-auto max-w-5xl space-y-8 px-4 pt-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-2xl font-bold sm:text-3xl">
            {firstName ? `Olá, ${firstName}` : "Olá"}
          </p>
          {!noProducts && (
            <Link to={NEW_PRODUCT_PATH} className={ADD_CLASSES}>
              <PlusIcon aria-hidden="true" className="size-6" />
              Cadastrar produto
            </Link>
          )}
        </div>
        {noProducts && <FirstProduct />}
        <div className="grid gap-6 lg:grid-cols-5">
          {(!noProducts || hasSales) && (
            <SummaryCard
              title="Vendas a entregar"
              state={sales}
              more={{ to: "/vendas", label: "Ver todas as vendas" }}
              className="lg:col-span-3 lg:row-span-2"
            >
              {(page) => <SalesSummary page={page} />}
            </SummaryCard>
          )}
          {!noProducts && (
            <>
              <SummaryCard
                title="Seus produtos"
                state={products}
                more={{ to: "/meus-produtos", label: "Ver meus produtos" }}
                className="lg:col-span-2"
              >
                {(data) => <ProductsSummary counts={data} />}
              </SummaryCard>
              <SummaryCard
                title="Sua nota"
                state={reviews}
                more={{ to: "/avaliacoes", label: "Ver avaliações" }}
                className="lg:col-span-2"
              >
                {(data) => <RatingSummary reviews={data} />}
              </SummaryCard>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
