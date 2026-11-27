import logoMark from "../assets/logo-mark.png";

export function Logo() {
  return (
    <>
      Conect<span className="font-bold text-lime-600">Agro</span>
    </>
  );
}

// a folha é só enfeite, então o leitor de tela a ignora
export function LogoMark() {
  return <img src={logoMark} alt="" width={192} height={153} className="w-16" />;
}
