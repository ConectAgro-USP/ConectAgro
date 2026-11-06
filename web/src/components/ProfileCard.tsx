import type { BuyerRead, LinkStatus, ProfileRead } from "../api/profiles";

const LINK_LABELS: Record<LinkStatus, string> = {
  APROVADO: "Morador Verificado",
  PENDENTE: "Morador aguardando aprovação",
  RECUSADO: "Morador com vínculo recusado",
};

function residence(buyer: BuyerRead): string {
  const parts: string[] = [];
  if (buyer.apartment) {
    parts.push(buyer.apartment.building_name);
  }
  if (buyer.block) {
    parts.push(`Bloco ${buyer.block}`);
  }
  parts.push(buyer.unit);
  return parts.join(", ");
}

function place(user: ProfileRead): string | null {
  if (user.buyer) {
    return residence(user.buyer);
  }
  if (user.apartment) {
    return user.apartment.building_name;
  }
  if (user.farmer) {
    return user.farmer.farm_name;
  }
  return null;
}

function profileLabel(user: ProfileRead): string {
  if (user.buyer) {
    return LINK_LABELS[user.buyer.link_status];
  }
  if (user.apartment) {
    return "Síndico";
  }
  if (user.farmer) {
    return "Agricultor";
  }
  return "";
}

export function ProfileCard({ user }: Readonly<{ user: ProfileRead }>) {
  const userPlace = place(user);

  return (
    <div className="rounded-lg bg-stone-200 p-4">
      <p className="text-2xl font-bold">{user.name}</p>
      {userPlace && <p className="text-stone-600">{userPlace}</p>}
      <p className="text-stone-600">{profileLabel(user)}</p>
    </div>
  );
}
