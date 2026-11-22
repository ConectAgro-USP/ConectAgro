import { useState } from "react";
import { CheckCircleIcon } from "lucide-react";
import { createInterest } from "../../api/interests";
import type { ProductDetail } from "../../api/products";
import { useAuth } from "../../auth/AuthContext";
import { PrimaryButton } from "../../components/Button";
import { FormError } from "../../components/FormError";
import { daysUntil, formatCount } from "../../format";
import { useAction } from "../../hooks/useAction";
import { ProductContact } from "./ProductContact";

const QUANTITY_CLASSES =
  "h-14 w-full rounded-xl border border-stone-400 bg-white px-4 text-stone-900 " +
  "focus:border-lime-800 focus:outline-1 focus:outline-lime-800 " +
  "disabled:cursor-not-allowed disabled:bg-stone-100";

interface ProductActionsProps {
  product: ProductDetail;
}

export function ProductActions({ product }: Readonly<ProductActionsProps>) {
  const { profileType } = useAuth();
  const isBuyer = profileType === "buyer";
  const isAvailable =
    product.is_available && product.quantity > 0 && daysUntil(product.expiration_date) >= 0;
  const [selectedQuantity, setSelectedQuantity] = useState(isAvailable ? "1" : "");
  const requestedQuantity = Number(selectedQuantity);
  const quantityExceedsStock = requestedQuantity > product.quantity;
  const interest = useAction();
  const [interestSuccess, setInterestSuccess] = useState(false);
  const canRegisterInterest =
    isAvailable && requestedQuantity > 0 && !quantityExceedsStock && !interestSuccess;

  function handleRegisterInterest() {
    interest.run(async () => {
      await createInterest({
        product_public_id: product.public_id,
        quantity: requestedQuantity,
      });
      setInterestSuccess(true);
    });
  }

  return (
    <>
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between">
          {isBuyer && (
            <label htmlFor="quantity-input" className="text-sm font-bold text-stone-900">
              Quantidade
            </label>
          )}
          <span className="text-sm font-medium text-stone-600">
            {isAvailable
              ? formatCount(product.quantity, "kg disponível", "kg disponíveis")
              : "Indisponível"}
          </span>
        </div>
        {isBuyer && (
          <>
            <input
              id="quantity-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={!isAvailable || interestSuccess}
              value={selectedQuantity}
              onChange={(event) => {
                if (/\D/.test(event.target.value)) {
                  return;
                }
                setSelectedQuantity(event.target.value);
                interest.setError("");
              }}
              className={QUANTITY_CLASSES}
            />
            {isAvailable && (
              <p className="mt-1 text-sm text-stone-500">
                Escolha uma quantidade de até {product.quantity} kg.
              </p>
            )}
            {quantityExceedsStock && (
              <p role="alert" className="mt-1 text-sm text-red-700">
                A quantidade informada excede o estoque disponível.
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {isBuyer && (
          <PrimaryButton
            type="button"
            disabled={interest.pending || !canRegisterInterest}
            onClick={handleRegisterInterest}
            className="w-full"
          >
            {interest.pending ? "Registrando interesse..." : "Registrar interesse"}
          </PrimaryButton>
        )}

        {isBuyer && <ProductContact productPublicId={product.public_id} recipient="síndico" />}
        {profileType === "apartment" && (
          <ProductContact productPublicId={product.public_id} recipient="agricultor" />
        )}

        {interestSuccess && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl bg-lime-100 p-4 text-sm font-semibold text-lime-900"
          >
            <CheckCircleIcon className="size-5 shrink-0 text-lime-800" />
            <span>Interesse registrado com sucesso!</span>
          </div>
        )}
        <FormError message={interest.error} />
      </div>
    </>
  );
}
