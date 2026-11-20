interface ProductImageProps {
  pictureUrl: string | null;
  productName: string;
}

export function ProductImage({ pictureUrl, productName }: Readonly<ProductImageProps>) {
  return (
    <div className="w-full shrink-0 md:w-72 lg:w-80">
      {pictureUrl ? (
        <img
          src={pictureUrl}
          alt={productName}
          className="aspect-square w-full rounded-2xl object-cover shadow-xs"
        />
      ) : (
        <div
          role="img"
          aria-label={`Sem foto para ${productName}`}
          className="flex aspect-square w-full items-center justify-center rounded-2xl bg-stone-100 font-medium text-stone-500 shadow-xs"
        >
          Sem foto
        </div>
      )}
    </div>
  );
}
