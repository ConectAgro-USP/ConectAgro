import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";

// quem sai fica na página inicial aberta, e não no login
export function useLogout(): () => Promise<void> {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return async () => {
    await logout();
    await navigate("/");
  };
}
