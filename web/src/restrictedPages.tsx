import {
  HandCoinsIcon,
  MapPinIcon,
  PackageIcon,
  ReceiptTextIcon,
  StarIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ProfileType } from "./api/profiles";
import { REVIEWS_PATH } from "./components/reviews/paths";
import { BuildingPurchases } from "./pages/BuildingPurchases";
import { MyReviews } from "./pages/MyReviews";
import { MySales } from "./pages/MySales";
import { MyProducts } from "./pages/MyProducts";
import { NearbyFarmers } from "./pages/NearbyFarmers";
import { Residents } from "./pages/Residents";
import { Reviews } from "./pages/Reviews";

interface RestrictedPage {
  path: string;
  label: string;
  icon: LucideIcon;
  profiles: ProfileType[];
  element: ReactNode;
}

// as rotas e os links do cabeçalho saem daqui, então só quem pode abrir a página vê o link
export const RESTRICTED_PAGES: RestrictedPage[] = [
  {
    path: "/agricultores",
    label: "Agricultores",
    icon: MapPinIcon,
    // a distância sai do CEP do prédio, que o síndico e o morador aprovado têm
    profiles: ["buyer", "apartment"],
    element: <NearbyFarmers />,
  },
  {
    path: "/moradores",
    label: "Moradores",
    icon: UsersIcon,
    profiles: ["apartment"],
    element: <Residents />,
  },
  {
    path: "/compras",
    label: "Compras do prédio",
    icon: ReceiptTextIcon,
    profiles: ["apartment"],
    element: <BuildingPurchases />,
  },
  {
    path: REVIEWS_PATH,
    label: "Avaliações",
    icon: StarIcon,
    profiles: ["apartment", "buyer"],
    element: <Reviews />,
  },
  {
    path: "/meus-produtos",
    label: "Meus produtos",
    icon: PackageIcon,
    profiles: ["farmer"],
    element: <MyProducts />,
  },
  {
    path: "/vendas",
    label: "Minhas vendas",
    icon: HandCoinsIcon,
    profiles: ["farmer"],
    element: <MySales />,
  },
  {
    path: "/avaliacoes",
    label: "Minhas avaliações",
    icon: StarIcon,
    profiles: ["farmer"],
    element: <MyReviews />,
  },
];

export function pagesOf(profileType: ProfileType | null): RestrictedPage[] {
  if (profileType === null) {
    return [];
  }
  return RESTRICTED_PAGES.filter((page) => page.profiles.includes(profileType));
}
