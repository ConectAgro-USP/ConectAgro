import {
  HandCoinsIcon,
  MapPinIcon,
  PackageIcon,
  ReceiptTextIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ProfileType } from "./api/profiles";
import { BuildingPurchases } from "./pages/BuildingPurchases";
import { MySales } from "./pages/MySales";
import { MyProducts } from "./pages/MyProducts";
import { NearbyFarmers } from "./pages/NearbyFarmers";
import { Residents } from "./pages/Residents";

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
];

export function pagesOf(profileType: ProfileType | null): RestrictedPage[] {
  if (profileType === null) {
    return [];
  }
  return RESTRICTED_PAGES.filter((page) => page.profiles.includes(profileType));
}
