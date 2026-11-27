import { useEffect } from "react";

const APP_NAME = "ConectAgro";

// o nome da página na aba do navegador, seguido do nome do site
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
    return () => {
      document.title = APP_NAME;
    };
  }, [title]);
}
