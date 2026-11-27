import { useAuth } from "../auth/AuthContext";
import { ProductSearch } from "./ProductSearch";

// só o visitante e quem compra buscam
export function HeaderSearch() {
  const { user, profileType } = useAuth();
  const buys = profileType === "buyer" || profileType === "apartment";
  if (user && !buys) {
    return null;
  }
  return <ProductSearch className="max-w-lg" />;
}
