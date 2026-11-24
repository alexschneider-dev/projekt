import { Armchair } from "lucide-react";
import type { CatalogProduct } from "@/lib/catalog/service";
import { Text } from "@/components/ui/text";


export function ProductImage({
  image,
  detail = false,
  compact = false
}: {
  image: CatalogProduct["image"];
  compact?: boolean;
  detail?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-xl bg-muted ${detail ? "aspect-square" : "aspect-[4/3]"}`}
    >
      {image ? (
        <img
          src={detail ? image.largeUrl : image.mediumUrl}
          srcSet={`${image.smallUrl} 160w, ${image.mediumUrl} 480w, ${image.largeUrl} 960w`}
          sizes={detail ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"}
          alt={image.alt}
          width={960}
          height={960}
          loading={detail ? "eager" : "lazy"}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Armchair
            size={compact ? 32 : detail ? 120 : 80}
            strokeWidth={1}
            aria-hidden="true"
          />
          {!compact && <Text variant="meta">Produktbild folgt</Text>}
        </div>
      )}
    </div>
  );
}
