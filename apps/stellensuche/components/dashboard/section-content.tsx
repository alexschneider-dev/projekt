import { Text } from "@/components/ui/text";
import SectionWrapper from "@/components/ui/page/section-wrapper";


type SectionContentProps = {
  title: string;
  description: string
};

export function SectionContent({
  title,
  description
}: SectionContentProps) {
  return (
    <SectionWrapper>
      <h1>{title}</h1>
      <Text variant="description">
        {description}
      </Text>
    </SectionWrapper>
  );
}
