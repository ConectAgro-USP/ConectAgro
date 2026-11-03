import { FormError } from "./FormError";

interface LookupStatusProps {
  searching: boolean;
  error: string;
}

export function LookupStatus({ searching, error }: Readonly<LookupStatusProps>) {
  if (searching) {
    return <p className="text-stone-600">Buscando o prédio...</p>;
  }
  return <FormError message={error} />;
}
