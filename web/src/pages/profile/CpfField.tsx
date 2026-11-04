import { TextField } from "../../components/TextField";

interface CpfFieldProps {
  label: string;
  value: string;
  onChange: (cpf: string) => void;
}

export function CpfField({ label, value, onChange }: Readonly<CpfFieldProps>) {
  return (
    <TextField
      label={label}
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
