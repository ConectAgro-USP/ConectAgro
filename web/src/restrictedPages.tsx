import {
  ClipboardListIcon,
  HandCoinsIcon,
  HeartIcon,
  HouseIcon,
  MapPinIcon,
  PackageIcon,
  ReceiptTextIcon,
  StarIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ProfileType } from "./api/profiles";
import { REVIEWS_PATH } from "./components/reviews/paths";
import { BuildingNeeds } from "./pages/BuildingNeeds";
import { BuildingPurchases } from "./pages/BuildingPurchases";
import { MyInterests } from "./pages/MyInterests";
import { MyReviews } from "./pages/MyReviews";
import { MySales } from "./pages/MySales";
import { MyProducts } from "./pages/MyProducts";
import { NearbyFarmers } from "./pages/NearbyFarmers";
import { Residents } from "./pages/Residents";
import { Reviews } from "./pages/Reviews";

export interface NavDestination {
  path: string;
  // nome curto do link, o título da página pode ser mais longo
  label: string;
  icon: LucideIcon;
}

interface RestrictedPage extends NavDestination {
  title: string;
  profiles: ProfileType[];
  element: ReactNode;
}

export const HOME_DESTINATION: NavDestination = { path: "/", label: "Início", icon: HouseIcon };
export const PROFILE_DESTINATION: NavDestination = {
  path: "/perfil",
  label: "Perfil",
  icon: UserIcon,
};

// as rotas e os links saem daqui, então só quem pode abrir a página vê o link
export const RESTRICTED_PAGES: RestrictedPage[] = [
  {
    path: "/moradores",
    label: "Moradores",
    title: "Moradores",
    icon: UsersIcon,
    profiles: ["apartment"],
    element: <Residents />,
  },
  {
    path: "/agricultores",
    label: "Agricultores",
    title: "Agricultores",
    icon: MapPinIcon,
    // a distância sai do CEP do prédio, que o síndico e o morador aprovado têm
    profiles: ["buyer", "apartment"],
    element: <NearbyFarmers />,
  },
  {
    path: "/necessidades",
    label: "Necessidades",
    title: "Necessidades do prédio",
    icon: ClipboardListIcon,
    profiles: ["apartment"],
    element: <BuildingNeeds />,
  },
  {
    path: "/compras",
    label: "Compras",
    title: "Compras do prédio",
    icon: ReceiptTextIcon,
    profiles: ["apartment"],
    element: <BuildingPurchases />,
  },
  {
    path: "/interesses",
    label: "Interesses",
    title: "Meus interesses",
    icon: HeartIcon,
    profiles: ["buyer"],
    element: <MyInterests />,
  },
  {
    path: REVIEWS_PATH,
    label: "Avaliações",
    title: "Avaliações",
    icon: StarIcon,
    profiles: ["apartment", "buyer"],
    element: <Reviews />,
  },
  {
    path: "/meus-produtos",
    label: "Produtos",
    title: "Meus produtos",
    icon: PackageIcon,
    profiles: ["farmer"],
    element: <MyProducts />,
  },
  {
    path: "/vendas",
    label: "Vendas",
    title: "Minhas vendas",
    icon: HandCoinsIcon,
    profiles: ["farmer"],
    element: <MySales />,
  },
  {
    path: "/avaliacoes",
    label: "Avaliações",
    title: "Minhas avaliações",
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

// destinos da barra inferior depois do início, os outros ficam no mais
const BOTTOM_BAR: Record<ProfileType, string[]> = {
  farmer: ["/meus-produtos", "/vendas", "/avaliacoes"],
  // com cinco botões o rótulo necessidades não cabe em 360 px
  apartment: ["/necessidades", "/compras"],
  buyer: ["/agricultores", "/interesses", REVIEWS_PATH],
};

interface Navigation {
  tabs: NavDestination[];
  more: NavDestination[];
}

export function navigationOf(profileType: ProfileType | null): Navigation {
  const pages = pagesOf(profileType);
  const bar = profileType === null ? [] : BOTTOM_BAR[profileType];
  const tabs = bar.flatMap((path) => pages.filter((page) => page.path === path));
  const more = pages.filter((page) => !bar.includes(page.path));
  return { tabs: [HOME_DESTINATION, ...tabs], more };
}
