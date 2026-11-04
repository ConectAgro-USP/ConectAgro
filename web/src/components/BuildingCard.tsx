interface BuildingCardProps {
  building: { building_name: string; address: string | null; manager_short_name?: string };
}

export function BuildingCard({ building }: Readonly<BuildingCardProps>) {
  return (
    <div className="px-4">
      <p className="text-lg font-bold">{building.building_name}</p>
      {building.address && <p className="text-stone-600">{building.address}</p>}
      {building.manager_short_name && (
        <p className="text-stone-600">Síndico: {building.manager_short_name}</p>
      )}
    </div>
  );
}
