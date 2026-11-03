interface BuildingCardProps {
  building: { building_name: string; address: string | null };
}

export function BuildingCard({ building }: Readonly<BuildingCardProps>) {
  return (
    <div className="px-4">
      <p className="text-lg font-bold">{building.building_name}</p>
      {building.address && <p className="text-stone-600">{building.address}</p>}
    </div>
  );
}
