import { useLocation, useNavigate } from "react-router";

// mostra o endereço atual, para o teste conferir a query string
export function Address() {
  const location = useLocation();
  return <p data-testid="address">{`${location.pathname}${location.search}`}</p>;
}

export function BackButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Voltar no navegador
    </button>
  );
}
