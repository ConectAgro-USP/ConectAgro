import { useEffect, useState } from "react";
import { listReviewable, type Reviewable } from "../api/reviews";

export function useReviewables(): Reviewable[] {
  const [reviewables, setReviewables] = useState<Reviewable[]>([]);

  useEffect(() => {
    let outdated = false;
    listReviewable()
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
