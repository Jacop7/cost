import type { ReactNode } from 'react';
import { Card } from '@/components/kit';
import { space } from '@/theme/tokens';

/** 상세·설정 화면 맨 위에 배치하는 공통 수정 내역 카드. */
export function RecentChangeCard({ children }: { children: ReactNode }) {
  return <Card pad={space.lg}>{children}</Card>;
}
