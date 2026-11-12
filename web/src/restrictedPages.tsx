import { HandCoinsIcon, ReceiptTextIcon, UsersIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { ProfileType } from "./api/profiles";
import { BuildingPurchases } from "./pages/BuildingPurchases";
import { MySales } from "./pages/MySales";
import { Residents } from "./pages/Residents";

interface RestrictedPage {
  path: string;
  label: string;
  icon: LucideIcon;
  profile: ProfileType;
  element: ReactNode;
}

// as rotas e os links do cabeçalho saem daqui, então só quem pode abrir a página vê o link
export const RESTRICTED_PAGES: RestrictedPage[] = [
  {
    path: "/moradores",
    label: "Moradores",
    icon: UsersIcon,
    profile: "apartment",
    element: <Residents />,
  },
  {
    path: "/compras",
    label: "Compras do prédio",
    icon: ReceiptTextIcon,
    profile: "apartment",
    element: <BuildingPurchases />,
  },
  {
    path: "/vendas",
    label: "Minhas vendas",
    icon: HandCoinsIcon,
    profile: "farmer",
    element: <MySales />,
  },
];
