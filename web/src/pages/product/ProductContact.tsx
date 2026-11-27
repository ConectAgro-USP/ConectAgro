import { useEffect, useState } from "react";
import { errorMessage } from "../../api/client";
import { getProductContact, type ProductContact as Contact } from "../../api/products";
import { FormError } from "../../components/FormError";
import { WhatsAppContact } from "../../components/WhatsAppContact";

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

  return (
    <>
      <WhatsAppContact
        recipient={recipient}
        cellphone={contact?.cellphone ?? null}
        message={contact?.message ?? ""}
        loaded={contact !== null}
      />
      <FormError message={error} />
    </>
  );
}
