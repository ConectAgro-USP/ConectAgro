import type { ProductDetail } from "../../api/products";
import { useAuth } from "../../auth/AuthContext";
import { stateOf } from "../../components/products/productState";
import { formatStock } from "../../format";
import { useCart } from "../../hooks/useCart";
import { CartBox } from "./CartBox";
import { InterestActions } from "./InterestActions";
import { ProductContact } from "./ProductContact";

interface ProductActionsProps {
  product: ProductDetail;
  // a API recusou uma escrita, e o produto pode ter mudado
  onConflict: () => void;
}

export function ProductActions({ product, onConflict }: Readonly<ProductActionsProps>) {
  const { profileType } = useAuth();
  const cart = useCart();
  const isAvailable = stateOf(product) === "available";
  const stock = isAvailable ? formatStock(product.quantity, product.unit) : "Indisponível";

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

  // o agricultor e o síndico ainda sem prédio veem só o estoque
  return (
    <>
      <p className="mt-4 font-medium text-stone-700">{stock}</p>
      {profileType === "apartment" && (
        <div className="mt-6">
          <ProductContact productPublicId={product.public_id} recipient="agricultor" />
        </div>
      )}
    </>
  );
}
