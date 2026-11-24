interface BuildingCardProps {
  building: {
    building_name: string;
    address: string | null;
    zip_code?: string | null;
    manager_short_name?: string;
  };
  // na escolha do prédio o CEP ajuda a separar nomes parecidos
  showZipCode?: boolean;
}

function formatZipCode(zipCode: string): string {
  const digits = zipCode.replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : zipCode;
}

export function BuildingCard({ building, showZipCode = false }: Readonly<BuildingCardProps>) {
  return (
    <div className="px-4">
      <p className="text-lg font-bold">{building.building_name}</p>
      {building.address && <p className="text-stone-600">{building.address}</p>}
      {showZipCode && building.zip_code && (
        <p className="text-stone-600">CEP {formatZipCode(building.zip_code)}</p>
      )}
      {building.manager_short_name && (
        <p className="text-stone-600">Síndico: {building.manager_short_name}</p>
      )}
    </div>
  );
}
