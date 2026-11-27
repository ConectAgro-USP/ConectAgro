import { useState } from "react";
import { CheckCircleIcon, ShoppingCartIcon } from "lucide-react";
import { Link } from "react-router";
import type { ProductDetail } from "../../api/products";
import { PrimaryButton } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { formatQuantity } from "../../format";
import { CART_FULL, useCart } from "../../hooks/useCart";
import { ProductContact } from "./ProductContact";
import { QuantityField } from "./QuantityField";
import { TEXT_LINK_CLASSES, upToHint } from "./buyBox";

const ICON_BUTTON_CLASSES = "flex w-full items-center justify-center gap-2";

interface CartBoxProps {
  product: ProductDetail;
  isAvailable: boolean;
  stock: string;
}

// o síndico põe o produto no carrinho, e a compra sai de lá
export function CartBox({ product, isAvailable, stock }: Readonly<CartBoxProps>) {
  const cart = useCart();
  const [selectedQuantity, setSelectedQuantity] = useState(isAvailable ? "1" : "");
  const [added, setAdded] = useState(false);
  const [cartError, setCartError] = useState("");
  const requestedQuantity = Number(selectedQuantity);
  // o que já está no carrinho sai do estoque que ainda cabe
  const inCart = cart.quantityOf(product.public_id);
  const room = product.quantity - inCart;
  const exceeds = requestedQuantity > room;
  const canAdd = isAvailable && requestedQuantity > 0 && !exceeds && !added;

  let hint = upToHint(product);
  if (inCart > 0) {
    const fits = `Cabem mais ${formatQuantity(room, product.unit)} no carrinho.`;
    hint = room > 0 ? fits : "Todo o estoque já está no carrinho.";
  }

  function handleAddToCart() {
    const item = {
      productPublicId: product.public_id,
      quantity: requestedQuantity,
      unitPrice: product.price,
      unit: product.unit,
    };
    if (cart.add(item, product.quantity)) setAdded(true);
    else setCartError(CART_FULL);
  }

  return (
    <>
      <div className="mt-4">
        <QuantityField
          stock={stock}
          value={selectedQuantity}
          disabled={!isAvailable || room <= 0}
          hint={isAvailable ? hint : null}
          exceeds={exceeds && room > 0}
          onChange={(value) => {
            setSelectedQuantity(value);
            setAdded(false);
            setCartError("");
          }}
        />
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          type="button"
          disabled={!canAdd}
          onClick={handleAddToCart}
          className={ICON_BUTTON_CLASSES}
        >
          {added ? (
            <CheckCircleIcon aria-hidden="true" className="size-5 shrink-0" />
          ) : (
            <ShoppingCartIcon aria-hidden="true" className="size-5 shrink-0" />
          )}
          {added ? "Adicionado ao carrinho" : "Adicionar ao carrinho"}
        </PrimaryButton>
        <ProductContact productPublicId={product.public_id} recipient="agricultor" />
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <output className="block font-bold text-stone-800">
            {inCart > 0 ? `No carrinho: ${formatQuantity(inCart, product.unit)}` : ""}
          </output>
          {inCart > 0 && (
            <Link to="/carrinho" className={TEXT_LINK_CLASSES}>
              Ver o carrinho
            </Link>
          )}
        </div>
        <FormError message={cartError} />
      </div>
    </>
  );
}
