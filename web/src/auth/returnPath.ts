// o login e o cadastro levam a pessoa de volta à página de onde ela veio
export const RETURN_PARAM = "proximo";

const STORAGE_KEY = "conectagro:proximo";

function hasControlCharacter(value: string): boolean {
  return [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
}

// só caminhos do próprio site, o resto volta ao início
export function safeReturnPath(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return hasControlCharacter(value) ? "/" : value;
}

export function withReturn(pathname: string, next: string): string {
  if (next === "/") return pathname;
  return `${pathname}?${RETURN_PARAM}=${encodeURIComponent(next)}`;
}

interface Place {
  pathname: string;
  search: string;
}

export function loginPathFrom({ pathname, search }: Place): string {
  return withReturn("/login", safeReturnPath(`${pathname}${search}`));
}

// o Google volta sempre ao início, então a página fica guardada na aba
export function rememberReturn(next: string): void {
  try {
    if (next === "/") sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, next);
  } catch {
    // sem o armazenamento a pessoa volta ao início
  }
}

export function takeReturn(): string | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    const next = safeReturnPath(stored);
    return next === "/" ? null : next;
  } catch {
    return null;
  }
}
