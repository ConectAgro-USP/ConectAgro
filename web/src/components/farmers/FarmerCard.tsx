import { ChevronDownIcon, StarIcon } from "lucide-react";
import { useId, useState } from "react";
import type { NearbyFarmer } from "../../api/farmers";
import { formatCount, formatDistance, formatPercent, formatRating } from "../../format";
import { FarmerProducts } from "./FarmerProducts";

const DISTANCE_TAB_CLASSES =
  "absolute top-0 right-0 rounded-tr-4xl rounded-bl-2xl bg-lime-700 px-5 py-1.5 text-lg " +
  "font-bold text-white tabular-nums";
const AVATAR_CLASSES =
  "flex size-14 shrink-0 items-center justify-center rounded-full bg-stone-800 text-xl " +
  "text-white uppercase ring-4 ring-stone-200 sm:size-16";
const PRODUCTS_BUTTON_CLASSES =
  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-lg hover:bg-stone-300 " +
  "focus-visible:outline-2 focus-visible:outline-lime-800";

// sem o nome do Google a API manda o nome vazio, e aí o sítio identifica o agricultor
function namesOf(farmer: NearbyFarmer): { title: string; subtitle: string | null } {
  if (farmer.name) {
    return { title: farmer.name, subtitle: farmer.farm_name };
  }
  return { title: farmer.farm_name ?? "Agricultor", subtitle: null };
}

function productsText(count: number): string {
  if (count === 0) {
    return "Nenhum produto disponível agora";
  }
  return formatCount(count, "produto disponível", "produtos disponíveis");
}

function Rating({ farmer }: Readonly<{ farmer: NearbyFarmer }>) {
  if (farmer.average_rating === null) {
    return <dd className="text-stone-600">Ainda sem avaliações</dd>;
  }
  return (
    <dd className="flex items-center gap-1.5">
      <StarIcon aria-hidden="true" className="size-5 fill-amber-400 text-amber-500" />
      <span className="font-bold tabular-nums">{formatRating(farmer.average_rating)}</span>{" "}
      <span className="sr-only">de 5</span>{" "}
      <span className="text-stone-600">
        ({formatCount(farmer.reviews_count, "avaliação", "avaliações")})
      </span>
    </dd>
  );
}

export function FarmerCard({ farmer }: Readonly<{ farmer: NearbyFarmer }>) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const productsId = useId();
  const nameId = useId();
  const { title, subtitle } = namesOf(farmer);
  const count = farmer.available_products_count;

  function toggleProducts() {
    setOpen(!open);
    setOpened(true);
  }

  return (
    <li className="relative rounded-4xl bg-stone-200 px-6 pt-14 pb-4 sm:px-10 sm:pt-8">
      <p className={DISTANCE_TAB_CLASSES}>
        <span className="sr-only">Distância: </span>
        {formatDistance(farmer.distance_km)}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-4">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-5">
          <span aria-hidden="true" className={AVATAR_CLASSES}>
            {title.charAt(0)}
          </span>
          <div className="min-w-0">
            <h2 id={nameId} className="text-2xl break-words sm:text-3xl">
              {title}
            </h2>
            {subtitle && <p className="text-stone-600">{subtitle}</p>}
          </div>
        </div>
        <dl className="space-y-1 text-lg sm:pt-8 sm:text-right">
          <div className="flex gap-2 sm:justify-end">
            <dt className="sr-only">Avaliação</dt>
            <Rating farmer={farmer} />
          </div>
          {farmer.on_time_delivery_percentage !== null && (
            <div className="flex gap-2 sm:justify-end">
              <dt>Entregas no prazo:</dt>
              <dd className="tabular-nums">{formatPercent(farmer.on_time_delivery_percentage)}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="mt-4 text-center">
        <p className={count === 0 ? "text-lg text-stone-600" : "text-xl font-bold"}>
          {productsText(count)}
        </p>
        {/* a contagem é de quando a lista carregou, então o botão aparece mesmo com zero */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={productsId}
          aria-describedby={nameId}
          onClick={toggleProducts}
          className={PRODUCTS_BUTTON_CLASSES}
        >
          {open ? "Ocultar produtos" : "Ver produtos"}
          <ChevronDownIcon aria-hidden="true" className={open ? "rotate-180" : ""} />
        </button>
      </div>
      <div id={productsId} hidden={!open} className="mt-2 border-t border-stone-400 py-4">
        {opened && <FarmerProducts key={farmer.public_id} farmerPublicId={farmer.public_id} />}
      </div>
    </li>
  );
}
