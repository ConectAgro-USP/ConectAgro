import { useState } from "react";
import { CheckCircleIcon, ShoppingCartIcon } from "lucide-react";
import { Link } from "react-router";
import type { ProductDetail } from "../../api/products";
import { useAuth } from "../../auth/AuthContext";
import { PrimaryButton } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { daysUntil, formatCount } from "../../format";
import { CART_LIMIT, useCart } from "../../hooks/useCart";
import { InterestActions } from "./InterestActions";
import { ProductContact } from "./ProductContact";
import { QUANTITY_CLASSES, TEXT_LINK_CLASSES, digitsOnly } from "./buyBox";

const ICON_BUTTON_CLASSES = "flex w-full items-center justify-center gap-2";

interface ProductActionsProps {
  product: ProductDetail;
}

export function ProductActions({ product }: Readonly<ProductActionsProps>) {
  const { profileType } = useAuth();
  const isBuyer = profileType === "buyer";
  const cart = useCart();
  const isAvailable =
    product.is_available && product.quantity > 0 && daysUntil(product.expiration_date) >= 0;
  const [selectedQuantity, setSelectedQuantity] = useState(isAvailable ? "1" : "");
  const requestedQuantity = Number(selectedQuantity);
  // para o síndico o que já está no carrinho sai do estoque que ainda cabe
  const inCart = cart.quantityOf(product.public_id);
  const room = product.quantity - inCart;
  const quantityExceedsStock = requestedQuantity > (cart.enabled ? room : product.quantity);
  const [added, setAdded] = useState(false);
  const [cartError, setCartError] = useState("");
  const canAdd = isAvailable && requestedQuantity > 0 && !quantityExceedsStock && !added;
  const stock = isAvailable
    ? formatCount(product.quantity, "kg disponível", "kg disponíveis")
    : "Indisponível";

  function handleAddToCart() {
    const item = {
      productPublicId: product.public_id,
      quantity: requestedQuantity,
      unitPrice: product.price,
    };
    if (cart.add(item, product.quantity)) setAdded(true);
    else setCartError(`O carrinho já tem ${CART_LIMIT} produtos, o limite de uma compra`);
  }

  // o morador escolhe a quantidade do interesse, que tem estados próprios
  if (isBuyer) {
    return (
      <>
        <InterestActions product={product} isAvailable={isAvailable} stock={stock} />
        <div className="mt-3">
          <ProductContact productPublicId={product.public_id} recipient="síndico" />
        </div>
      </>
    );
  }

  let hint = `Escolha uma quantidade de até ${product.quantity} kg.`;
  if (cart.enabled && inCart > 0) {
    hint = room > 0 ? `Cabem mais ${room} kg no carrinho.` : "Todo o estoque já está no carrinho.";
  }

  return (
    <>
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between">
          {cart.enabled && (
            <label htmlFor="quantity-input" className="font-bold text-stone-900">
              Quantidade
            </label>
          )}
          <span className="font-medium text-stone-700">{stock}</span>
        </div>
        {cart.enabled && (
          <>
            <input
              id="quantity-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={!isAvailable || room <= 0}
              value={selectedQuantity}
              onChange={(event) => {
                if (!digitsOnly(event.target.value)) return;
                setSelectedQuantity(event.target.value);
                setAdded(false);
                setCartError("");
              }}
              className={QUANTITY_CLASSES}
            />
            {isAvailable && <p className="mt-1 text-stone-700">{hint}</p>}
            {quantityExceedsStock && !(cart.enabled && room <= 0) && (
              <p role="alert" className="mt-1 font-bold text-red-700">
                A quantidade informada excede o estoque disponível.
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {cart.enabled && (
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
        )}

        {profileType === "apartment" && (
          <ProductContact productPublicId={product.public_id} recipient="agricultor" />
        )}

        {cart.enabled && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p role="status" className="font-bold text-stone-800">
              {inCart > 0 ? `No carrinho: ${inCart} kg` : ""}
            </p>
            {inCart > 0 && (
              <Link to="/carrinho" className={TEXT_LINK_CLASSES}>
                Ver o carrinho
              </Link>
            )}
          </div>
        )}
        <FormError message={cartError} />
      </div>
    </>
  );
}
