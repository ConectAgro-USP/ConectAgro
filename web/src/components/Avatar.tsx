const BASE_CLASSES =
  "flex size-14 shrink-0 items-center justify-center rounded-full bg-stone-800 text-xl " +
  "text-white uppercase";
// o anel separa os avatares que ficam um sobre o outro
const RING_CLASSES = "ring-4 ring-white sm:size-16";

interface AvatarProps {
  name: string;
  plain?: boolean;
}

export function Avatar({ name, plain = false }: Readonly<AvatarProps>) {
  return (
    <span aria-hidden="true" className={plain ? BASE_CLASSES : `${BASE_CLASSES} ${RING_CLASSES}`}>
      {name.charAt(0)}
    </span>
  );
}
