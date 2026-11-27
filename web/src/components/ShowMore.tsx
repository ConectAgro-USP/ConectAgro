import { SecondaryButton } from "./Button";

export interface PagedList {
  hasMore: boolean;
  loading: boolean;
  error: string;
  loadMore: () => void;
}

interface ShowMoreProps {
  list: PagedList;
  label: string;
  className?: string;
}

// some enquanto a página seguinte carrega ou quando o pedido falha
export function ShowMore({ list, label, className = "" }: Readonly<ShowMoreProps>) {
  if (!list.hasMore || list.loading || list.error) return null;
  return (
    <SecondaryButton onClick={list.loadMore} className={className}>
      {label}
    </SecondaryButton>
  );
}
