// compacto para ações dentro de cartões, grande para formulários
export type ButtonSize = "large" | "compact";
export type ButtonVariant = "primary" | "secondary" | "danger";

const BUTTON_CLASSES =
  "rounded-full font-bold focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-lime-800 disabled:cursor-not-allowed disabled:opacity-60";
const SIZE_CLASSES: Record<ButtonSize, string> = {
  large: "h-14 px-8",
  compact: "h-11 px-5",
};
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-lime-800 text-white hover:bg-lime-900",
  secondary: "border border-stone-400 bg-white hover:bg-stone-50",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

// também vale para o link com cara de botão, que junta o próprio layout
export function buttonClasses(variant: ButtonVariant, size: ButtonSize = "large"): string {
  return `${BUTTON_CLASSES} ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]}`;
}
