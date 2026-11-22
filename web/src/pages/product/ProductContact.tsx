import { MessageCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { errorMessage } from "../../api/client";
import { getProductContact, type ProductContact as Contact } from "../../api/products";
import { FormError } from "../../components/FormError";

const CONTACT_CLASSES =
  "flex h-14 w-full items-center justify-center gap-2 rounded-full bg-stone-800 font-bold " +
  "text-white hover:bg-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-stone-800 disabled:cursor-not-allowed disabled:opacity-60";

// a API guarda o celular com DDD, sem o código do país
function whatsAppUrl(cellphone: string, message: string): string {
  return `https://wa.me/55${cellphone}?text=${encodeURIComponent(message)}`;
}

interface ProductContactProps {
  productPublicId: string;
  recipient: "síndico" | "agricultor";
}

export function ProductContact({ productPublicId, recipient }: Readonly<ProductContactProps>) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let outdated = false;
    getProductContact(productPublicId)
      .then((loaded) => {
        if (!outdated) setContact(loaded);
      })
      .catch((loadError: unknown) => {
        if (!outdated) setError(errorMessage(loadError));
      });
    return () => {
      outdated = true;
    };
  }, [productPublicId]);

  const label = (
    <>
      <MessageCircleIcon aria-hidden="true" className="size-5" />
      Falar com o {recipient}
    </>
  );

  if (contact?.cellphone) {
    return (
      <a
        href={whatsAppUrl(contact.cellphone, contact.message)}
        target="_blank"
        rel="noopener noreferrer"
        className={CONTACT_CLASSES}
      >
        {label}
      </a>
    );
  }
  return (
    <>
      <button type="button" disabled className={CONTACT_CLASSES}>
        {label}
      </button>
      {contact && (
        <p className="text-sm text-stone-600">O {recipient} ainda não cadastrou um telefone.</p>
      )}
      <FormError message={error} />
    </>
  );
}
