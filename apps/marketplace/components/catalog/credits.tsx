import { prisma } from "@/lib/prisma";
import PageWrapper from "@/components/ui/page/page-wrapper";
import { AppLink } from "@/components/ui/app-link";
import { Text } from "@/components/ui/text";
import { ROUTES } from "@/lib/constants/routes";


export async function Credits({ page }: { page: number }) {
  const images = await prisma.imageAsset.findMany({
    orderBy: { id: "asc" },
    skip: (page - 1) * 100,
    take: 101,
  });
  return (
    <PageWrapper>
      <h1>Bildnachweise</h1>
      <Text variant="description">
        Produktfotos von{" "}
        <AppLink
          href="https://www.pexels.com"
          navigationMode="document"
        >
          Pexels
        </AppLink>
        . Vielen Dank an die Fotografen.
      </Text>
      <ul className="mt-6 space-y-3">
        {images.slice(0, 100).map((image) => (
          <li key={image.id}>
            <AppLink
              href={image.sourceUrl}
              navigationMode="document"
            >
              {image.alt}
            </AppLink>{" "}
            ·{" "}
            <AppLink
              href={image.photographerUrl}
              navigationMode="document"
            >
              {image.photographer}
            </AppLink>
          </li>
        ))}
      </ul>
      {!images.length && <Text variant="hint">Es wurden noch keine externen Produktbilder importiert.</Text>}
      {page > 1 && <AppLink href={`${ROUTES.credits}?page=${page - 1}`}>Vorherige Bildnachweise</AppLink>}
      {images.length > 100 && <AppLink href={`${ROUTES.credits}?page=${page + 1}`}>Weitere Bildnachweise</AppLink>}
    </PageWrapper>
  );
}
