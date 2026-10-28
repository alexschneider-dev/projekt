import SectionWrapper from "@/components/ui/page/section-wrapper";

type SectionContentProps = { title: string; description: string };

export function SectionContent({ title, description }: SectionContentProps) {
  return (
    <SectionWrapper>
      <h1 className="text-3xl font-semibold [overflow-wrap:anywhere]">{title}</h1>
      <p className="mt-3 text-muted-foreground">{description}</p>
    </SectionWrapper>
  );
}
