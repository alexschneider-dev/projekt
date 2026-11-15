import { AppLink } from "@/components/ui/app-link";
import SectionWrapper from "@/components/ui/page/section-wrapper";
import { Text } from "@/components/ui/text";
import { prisma } from "@/lib/prisma";


export async function JobLinks() {
  const jobs = await prisma.jobListing.findMany({
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    select: {
      id: true,
      url: true,
    },
  });

  return (
    <SectionWrapper>
      <h1>Stellen</h1>
      {jobs.length === 0 ? (
        <Text variant="description">
          Noch keine Stellen gefunden.
        </Text>
      ) : (
        <ul className="mt-4 space-y-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <AppLink
                href={job.url}
                navigationMode="document"
                className="wrap-anywhere"
              >
                {job.url}
              </AppLink>
            </li>
          ))}
        </ul>
      )}
    </SectionWrapper>
  );
}
