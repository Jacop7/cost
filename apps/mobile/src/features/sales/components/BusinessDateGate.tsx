/**
 * 서버가 날짜를 알려 줄 때까지 화면 본체를 **안 그린다**.
 *
 * 왜 필요한가 —
 *   날짜 권위를 서버로 옮기면서 "아직 날짜를 모르는 순간" 이 생겼다(0125).
 *   그 순간을 각 화면이 알아서 다루게 두면 두 가지가 새어 나온다.
 *
 *   ① **잘못된 값이 잠깐 보인다.** 빈 문자열을 그대로 그리면
 *      `dayLabel('')` 이 `NaN월 NaN일` 을 낸다. 실제로 판매 홈 머리글이 그랬다.
 *   ② **실패가 로딩으로 보인다.** 날짜 RPC 가 죽어도 화면은 계속 "불러오는 중" 이다.
 *      사장님은 기다리기만 하고 다시 시도할 길이 없다.
 *
 * 그래서 셋을 한 곳에서 다룬다 — 로딩 · 오류(재시도 포함) · 성공.
 *
 * ⚠ 본체는 날짜를 **prop 으로** 받는다. 그래야 그 안의 훅들이 언제나 진짜 날짜를 본다.
 *   훅은 조건부로 못 부르므로, 빈 날짜로 한 번 렌더되면 `useState(today)` 같은 자리에
 *   그 빈 값이 굳어 나중에 서버 날짜가 와도 안 바뀐다.
 *
 * ⚠ 날짜가 **바뀌면 본체를 다시 만든다**(`key`). 화면을 열어 둔 채 자정을 넘기거나
 *   영업일이 바뀌면 내부 상태가 옛 날짜에 남기 때문이다.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppHeader, QueryState } from '@/components/kit';
import { T } from '@/theme/tokens';
import type { ServerDate } from '../businessDay';

export function BusinessDateGate({
  source, title, onBack, children,
}: {
  /** `useSalesBusinessDate()` 또는 `useStoreLocalDate()` 의 반환값. */
  source: ServerDate;
  /** 기다리는 동안에도 머리글은 보여 준다 — 빈 화면만 뜨면 어디인지 모른다. */
  title: string;
  onBack?: () => void;
  children: (date: string) => ReactNode;
}) {
  const { date, isLoading, error, refetch } = source;

  if (!date) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <AppHeader title={title} onBack={onBack} />
        <QueryState
          isLoading={isLoading}
          error={error}
          isEmpty={false}
          onRetry={refetch}
          emptyTitle="날짜를 확인하지 못했어요"
          emptyHint="잠시 후 다시 시도해 주세요"
        >
          {null}
        </QueryState>
      </View>
    );
  }

  // key 로 날짜가 바뀔 때 본체를 갈아 끼운다(위 ⚠ 참고).
  return <View key={date} style={{ flex: 1 }}>{children(date)}</View>;
}
