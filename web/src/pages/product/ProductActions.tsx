import { useState } from "react";
import { CheckCircleIcon, MessageCircleIcon } from "lucide-react";
import { errorMessage } from "../../api/client";
import { createInterest } from "../../api/interests";
import {
  getProductContact,
  type ProductContact,
  type ProductDetail,
} from "../../api/products";
import { useAuth } from "../../auth/AuthContext";
import { PrimaryButton } from "../../components/Button";
import { FormError } from "../../components/FormError";

const MAX_QUANTITY = 50;

function formatWhatsAppUrl(cellphone: string, message: string): string {
  const digits = cellphone.replace(/\D/g, "");
  const phone = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

interface ProductActionsProps {
  product: ProductDetail;
}

export function ProductActions({ product }: Readonly<ProductActionsProps>) {
  const { profileType } = useAuth();
  const isAvailable = product.is_available && product.quantity > 0;
  const maxInterestQuantity = Math.min(product.quantity, MAX_QUANTITY);
  const [selectedQuantity, setSelectedQuantity] = useState(isAvailable ? "1" : "");
  const requestedQuantity = selectedQuantity === "" ? 0 : Number(selectedQuantity);
  const quantityExceedsStock = requestedQuantity > product.quantity;

  const canRegisterInterest =
    isAvailable &&
    requestedQuantity > 0 &&
    requestedQuantity <= MAX_QUANTITY &&
    !quantityExceedsStock;

  const [interestPending, setInterestPending] = useState(false);
  const [interestSuccess, setInterestSuccess] = useState(false);
  const [interestError, setInterestError] = useState("");

  const [contactPending, setContactPending] = useState(false);
  const [contactError, setContactError] = useState("");

  async function handleRegisterInterest() {
    if (!canRegisterInterest) return;
    setInterestError("");
    setInterestSuccess(false);
    setInterestPending(true);
    try {
      await createInterest({
        product_public_id: product.public_id,
        quantity: requestedQuantity,
      });
      setInterestSuccess(true);
    } catch (err) {
      setInterestError(errorMessage(err));
    } finally {
      setInterestPending(false);
    }
  }

  async function handleOpenWhatsApp() {
    setContactError("");
    setContactPending(true);
    try {
      const contact: ProductContact = await getProductContact(product.public_id);
      if (!contact.cellphone || contact.cellphone.trim() === "") {
        setContactError("Telefone não informado para contato");
        return;
      }
      const url = formatWhatsAppUrl(contact.cellphone, contact.message);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setContactError(errorMessage(err));
    } finally {
      setContactPending(false);
    }
  }

  return (
    <>
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="quantity-input" className="text-sm font-bold text-stone-900">
            Quantidade
          </label>
          <span className="text-sm font-medium text-stone-600">
            {isAvailable ? `${product.quantity} kg disponíveis` : "Indisponível"}
          </span>
        </div>
        <input
          id="quantity-input"
          aria-label="Quantidade"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          disabled={!isAvailable}
          value={selectedQuantity}
          onChange={(e) => {
            const value = e.target.value;
            const containsNonDigit = /[^0-9]/.test(value);
            const exceedsMaxQuantity = value !== "" && Number(value) > MAX_QUANTITY;

            if (containsNonDigit || exceedsMaxQuantity)
              return;
      
            setSelectedQuantity(value);
            setInterestSuccess(false);
            setInterestError("");
          }}
          className="h-14 w-full rounded-xl border border-stone-400 bg-white px-4 text-stone-900 focus:border-lime-800 focus:outline-1 focus:outline-lime-800 disabled:cursor-not-allowed disabled:bg-stone-100"
        />
        <p className="mt-1 text-sm text-stone-500">
          Escolha uma quantidade entre 0 e 50 kg. Máximo disponível: {maxInterestQuantity} kg.
        </p>
        {quantityExceedsStock && (
          <p role="alert" className="mt-1 text-sm text-red-700">
            A quantidade informada excede o estoque disponível.
          </p>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {profileType === "buyer" && (
          <PrimaryButton
            type="button"
            disabled={interestPending || !canRegisterInterest}
            onClick={handleRegisterInterest}
            className="w-full"
          >
            {interestPending ? "Registrando interesse..." : "Registrar interesse"}
          </PrimaryButton>
        )}

        <button
          type="button"
          disabled={contactPending}
          onClick={handleOpenWhatsApp}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-stone-800 font-bold text-white transition hover:bg-stone-900 focus-visible:outline-2 focus-visible:outline-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <MessageCircleIcon className="size-5" />
          <span>
            {profileType === "apartment"
              ? "Conversar com o agricultor no WhatsApp"
              : "Conversar no WhatsApp"}
          </span>
        </button>

        {interestSuccess && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl bg-lime-100 p-4 text-sm font-semibold text-lime-900"
          >
            <CheckCircleIcon className="size-5 shrink-0 text-lime-800" />
            <span>Interesse registrado com sucesso!</span>
          </div>
        )}
        <FormError message={interestError} />
        <FormError message={contactError} />
      </div>
    </>
  );
}
