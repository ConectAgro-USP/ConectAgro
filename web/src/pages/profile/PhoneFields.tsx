import { TextField } from "../../components/TextField";

export interface Phones {
  cellphone: string;
  homephone: string;
}

interface PhoneFieldsProps {
  phones: Phones;
  onChange: (phones: Phones) => void;
}

export function PhoneFields({ phones, onChange }: Readonly<PhoneFieldsProps>) {
  return (
    <>
      <TextField
        label="Celular"
        type="tel"
        autoComplete="tel-national"
        value={phones.cellphone}
        onChange={(event) => onChange({ ...phones, cellphone: event.target.value })}
      />
      <TextField
        label="Telefone Fixo"
        optional
        type="tel"
        autoComplete="tel-national"
        value={phones.homephone}
        onChange={(event) => onChange({ ...phones, homephone: event.target.value })}
      />
    </>
  );
}
