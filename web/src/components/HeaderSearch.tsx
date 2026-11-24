import { useAuth } from "../auth/AuthContext";
import { ProductSearch } from "./ProductSearch";

// só quem compra busca, e abaixo de 1024 px a busca fica no catálogo
export function HeaderSearch() {
  const { profileType } = useAuth();
  if (profileType !== "buyer" && profileType !== "apartment") {
    return null;
  }
  return <ProductSearch className="hidden max-w-lg lg:flex" />;
}
