import { type Href, useRouter } from 'expo-router';
import { View } from 'react-native';
import { SegTabs } from '@/components/kit';
import { T, space } from '@/theme/tokens';

export type SalesSection = 'write' | 'analytics';

const sections: { key: SalesSection; label: string; href: Href }[] = [
  { key: 'write', label: '매출 작성', href: '/sales' as Href },
  { key: 'analytics', label: '매출 분석', href: '/sales/analytics' as Href },
];

export function SalesSectionTabs({ active }: { active: SalesSection }) {
  const router = useRouter();
  const activeIndex = sections.findIndex(section => section.key === active);

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: T.line3 }}>
      <SegTabs
        tabs={sections.map(section => ({ label: section.label }))}
        active={activeIndex}
        onChange={index => {
          const section = sections[index];
          if (section && section.key !== active) router.replace(section.href);
        }}
      />
    </View>
  );
}
