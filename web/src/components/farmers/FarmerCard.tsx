import { ChevronDownIcon } from "lucide-react";
import { useId, useState } from "react";
import type { NearbyFarmer } from "../../api/farmers";
import { formatCount, formatDistance, formatPercent } from "../../format";
import type { InterestLookup } from "../../hooks/useInterestLookup";
import { Avatar } from "../Avatar";
import { CARD_PANEL, CARD_SURFACE, CARD_TAB, CARD_TOGGLE } from "../surface";
import { FarmerProducts } from "./FarmerProducts";
import { FarmerRating } from "./FarmerRating";

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

interface FarmerCardProps {
  farmer: NearbyFarmer;
  interests: InterestLookup;
}

export function FarmerCard({ farmer, interests }: Readonly<FarmerCardProps>) {
  // no celular a aba da distância fica por cima do nome
  const topSpace = farmer.distance_km === null ? "pt-6" : "pt-14";
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
    <li className={`relative px-6 pb-4 sm:px-10 sm:pt-8 ${CARD_SURFACE} ${topSpace}`}>
      {farmer.distance_km !== null && (
        <p className={`${CARD_TAB} bg-lime-700 tabular-nums`}>
          <span className="sr-only">Distância: </span>
          {formatDistance(farmer.distance_km)}
        </p>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-4">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-5">
          <Avatar name={title} />
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
            <dd>
              <FarmerRating average={farmer.average_rating} count={farmer.reviews_count} />
            </dd>
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
          className={CARD_TOGGLE}
        >
          {open ? "Ocultar produtos" : "Ver produtos"}
          <ChevronDownIcon aria-hidden="true" className={open ? "rotate-180" : ""} />
        </button>
      </div>
      <div id={productsId} hidden={!open} className={CARD_PANEL}>
        {opened && (
          <FarmerProducts
            key={farmer.public_id}
            farmerPublicId={farmer.public_id}
            interests={interests}
          />
        )}
      </div>
    </li>
  );
}
