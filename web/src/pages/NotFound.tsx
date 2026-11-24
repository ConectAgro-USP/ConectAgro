import { Link } from "react-router";
import { buttonClasses } from "../components/buttonClasses";
import { TitleBar } from "../components/TitleBar";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const HOME_LINK_CLASSES = `flex items-center text-base ${buttonClasses("primary")}`;

interface MessagePageProps {
  title: string;
  tabTitle: string;
  message: string;
}

function MessagePage({ title, tabTitle, message }: Readonly<MessagePageProps>) {
  useDocumentTitle(tabTitle);

  return (
    <main className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <TitleBar title={title} />
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 pt-12 text-center">
        <p className="text-xl text-balance">{message}</p>
        <Link to="/" className={HOME_LINK_CLASSES}>
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}

export function NotFound() {
  return (
    <MessagePage
      title="Página não encontrada"
      tabTitle="Página não encontrada"
      message="Este endereço não existe no ConectAgro. Confira o link ou volte ao início."
    />
  );
}

export function NoAccess() {
  return (
    <MessagePage
      title="Você não tem acesso a esta página"
      tabTitle="Sem acesso"
      message="Ela é de outro tipo de conta. No início você encontra o que é seu."
    />
  );
}
