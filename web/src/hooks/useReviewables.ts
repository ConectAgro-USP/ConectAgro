import { useEffect, useState } from "react";
import { listAllReviewables, type Reviewable } from "../api/reviews";

export function useReviewables(): Reviewable[] {
  const [reviewables, setReviewables] = useState<Reviewable[]>([]);

  useEffect(() => {
    let outdated = false;
    // todas as páginas, para cada compra na tela achar a sua entrega
    listAllReviewables()
      .then((list) => {
        if (!outdated) setReviewables(list);
      })
      .catch((loadError: unknown) => console.error(loadError));
    return () => {
      outdated = true;
    };
  }, []);

  return reviewables;
}
