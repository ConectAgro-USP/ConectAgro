import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

const INPUT_CLASSES =
  "h-14 w-full rounded-lg border border-stone-400 px-4 focus:border-lime-800 focus:outline-1 " +
  "focus:outline-lime-800";
const EYE_BUTTON_CLASSES =
  "absolute inset-y-0 right-0 flex w-14 items-center justify-center rounded-r-lg text-lime-800 " +
  "focus-visible:outline-2 focus-visible:outline-lime-800";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  optional?: boolean;
  hint?: string;
  children?: ReactNode;
}

export function TextField({
  label,
  optional = false,
  hint,
  children,
  ...inputProps
}: Readonly<TextFieldProps>) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-bold">
        {label}
        {optional && <span className="font-normal"> (opcional)</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          required={!optional}
          aria-describedby={hint ? hintId : undefined}
          className={`${INPUT_CLASSES} ${children ? "pr-14" : ""}`}
          {...inputProps}
        />
        {children}
      </div>
      {hint && (
        <p id={hintId} className="mt-2 text-stone-600">
          {hint}
        </p>
      )}
    </div>
  );
}

export function PasswordField(props: Readonly<Omit<TextFieldProps, "type" | "children">>) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      spellCheck={false}
      autoCapitalize="none"
      autoCorrect="off"
    >
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        className={EYE_BUTTON_CLASSES}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </TextField>
  );
}
