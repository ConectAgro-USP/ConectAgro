export const QUANTITY_CLASSES =
  "h-14 w-full rounded-xl border border-stone-400 bg-white px-4 text-stone-900 " +
  "focus:border-lime-800 focus:outline-1 focus:outline-lime-800 " +
  "disabled:cursor-not-allowed disabled:bg-stone-100";
export const NOTE_CLASSES = "space-y-1 rounded-xl bg-stone-100 p-4 text-stone-800";
export const TEXT_LINK_CLASSES =
  "rounded font-bold text-lime-800 underline focus-visible:outline-2 focus-visible:outline-lime-800";

// o campo aceita só dígitos, o resto do que se digita é ignorado
export function digitsOnly(value: string): boolean {
  return !/\D/.test(value);
}
