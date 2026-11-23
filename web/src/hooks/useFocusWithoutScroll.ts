import { useEffect, useId } from "react";

// devolve o id do elemento que recebe o foco quando a confirmação abre
export function useFocusWithoutScroll(active: boolean): string {
  const id = useId();

  useEffect(() => {
    // rolar a tela traria o botão que confirma para baixo do segundo toque
    if (active) document.getElementById(id)?.focus({ preventScroll: true });
  }, [active, id]);

  return id;
}
