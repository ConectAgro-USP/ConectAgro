import { LogInIcon } from "lucide-react";
import { Link, useLocation } from "react-router";
import type { ProductDetail } from "../../api/products";
import { useAuth } from "../../auth/AuthContext";
import { loginPathFrom } from "../../auth/returnPath";
import { buttonClasses } from "../../components/buttonClasses";
import { stateOf } from "../../components/products/productState";
import { formatStock } from "../../format";
import { useCart } from "../../hooks/useCart";
import { CartBox } from "./CartBox";
import { InterestActions } from "./InterestActions";
import { ProductContact } from "./ProductContact";

const LOGIN_CLASSES =
  `mt-6 flex w-full items-center justify-center gap-2 ${buttonClasses("primary")}`;

interface VisitorActionsProps {
  isAvailable: boolean;
  stock: string;
}

// quem não entrou vê o estoque e entra para pedir, sem contato nem quantidade
function VisitorActions({ isAvailable, stock }: Readonly<VisitorActionsProps>) {
  const location = useLocation();

  return (
    <>
      <p className="mt-4 font-medium text-stone-700">{stock}</p>
      {isAvailable && (
        <Link to={loginPathFrom(location)} className={LOGIN_CLASSES}>
          <LogInIcon aria-hidden="true" className="size-5 shrink-0" />
          Entrar para pedir
        </Link>
      )}
    </>
  );
}

interface ProductActionsProps {
  product: ProductDetail;
  // a API recusou uma escrita, e o produto pode ter mudado
  onConflict: () => void;
}

export function ProductActions({ product, onConflict }: Readonly<ProductActionsProps>) {
  const { user, profileType } = useAuth();
  const cart = useCart();
  const isAvailable = stateOf(product) === "available";
  const stock = isAvailable ? formatStock(product.quantity, product.unit) : "Indisponível";

  if (!user) {
    return <VisitorActions isAvailable={isAvailable} stock={stock} />;
  }

  // o morador escolhe a quantidade do interesse, que tem estados próprios
  if (profileType === "buyer") {
    return (
      <>
        <InterestActions
          product={product}
          isAvailable={isAvailable}
          stock={stock}
          onConflict={onConflict}
        />
        <div className="mt-3">
          <ProductContact productPublicId={product.public_id} recipient="síndico" />
        </div>
      </>
    );
  }

  if (cart.enabled) {
    return <CartBox product={product} isAvailable={isAvailable} stock={stock} />;
  }

  // o agricultor vê só o estoque
  return <p className="mt-4 font-medium text-stone-700">{stock}</p>;
}
