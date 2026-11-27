import { useAuth } from "../auth/AuthContext";
import { Catalog } from "./Catalog";
import { FarmerHome } from "./FarmerHome";

export function Dashboard() {
  const { profileType } = useAuth();
  return profileType === "farmer" ? <FarmerHome /> : <Catalog />;
}
