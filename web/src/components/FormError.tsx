export function FormError({ message }: Readonly<{ message: string }>) {
  if (!message) {
    return null;
  }
  return (
    <p role="alert" className="font-bold text-red-700">
      {message}
    </p>
  );
}
