// fundo, borda e raio de todo cartão, sem sombra
export const CARD_SURFACE = "rounded-3xl border border-stone-300 bg-white";

// o canto da aba acompanha o raio de dentro da borda do cartão
export const CARD_TAB =
  "absolute top-0 right-0 rounded-tr-[calc(var(--radius-3xl)-1px)] rounded-bl-2xl px-5 " +
  "py-1.5 text-lg font-bold text-white";

// o botão que abre a parte de baixo do cartão e a parte que ele abre
export const CARD_TOGGLE =
  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-lg hover:bg-stone-100 " +
  "focus-visible:outline-2 focus-visible:outline-lime-800";
export const CARD_PANEL = "mt-2 border-t border-stone-300 py-4";
