const AVATAR_CLASSES =
  "flex size-14 shrink-0 items-center justify-center rounded-full bg-stone-800 text-xl " +
  "text-white uppercase ring-4 ring-white sm:size-16";

export function FarmerAvatar({ name }: Readonly<{ name: string }>) {
  return (
    <span aria-hidden="true" className={AVATAR_CLASSES}>
      {name.charAt(0)}
    </span>
  );
}
