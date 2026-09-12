import { Badge } from '@/components/kit';

/** Every history title identifies who initiated the change, independently of its financial effect. */
export function ChangeSourceBadge({ automatic }: { automatic: boolean }) {
  return <Badge sm tone={automatic ? 'blue' : 'neutral'}>{automatic ? '자동 갱신' : '직접 수정'}</Badge>;
}
