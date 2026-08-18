/**
 * 세션·매장 컨텍스트 프로바이더 — 모든 실데이터 조회의 전제.
 *
 * RLS 가 `store_id in (select my_store_ids())` 이고 `my_store_ids()` 는
 * `stores where owner_id = auth.uid()` 다. **로그인하지 않으면 어떤 행도 보이지 않는다.**
 * 그래서 화면의 "데이터가 없어요"는 대개 빈 테이블이 아니라 세션이 없는 것이다 —
 * 이 둘을 반드시 구분해서 보여줘야 한다(가이드 §9.8).
 *
 * 여기서 준비 상태를 한 번만 판정하고 화면에는 이미 확정된 `storeId` 만 내려준다.
 * 화면마다 세션을 확인하게 하면 그 분기가 39개 화면에 복제된다.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from '@/components/kit';
import { T } from '@/theme/tokens';
import { useSession, type SessionState } from './session';

const SessionContext = createContext<SessionState | null>(null);

/**
 * 준비된 세션. `SessionGate` 안에서만 호출해야 하며, 그 안에서는 `storeId` 가 항상 존재한다.
 * (게이트가 준비되지 않은 상태를 이미 걸러냈다.)
 */
export function useStoreId(): string {
  const s = useContext(SessionContext);
  if (s === null) throw new Error('useStoreId 는 SessionGate 안에서만 쓸 수 있습니다.');
  if (s.storeId === null) throw new Error('세션이 준비되기 전에 useStoreId 가 호출됐습니다.');
  return s.storeId;
}

/** 준비 여부와 무관하게 현재 세션 상태를 본다(게이트 자신·디버그용). */
export function useSessionState(): SessionState {
  const s = useContext(SessionContext);
  if (s === null) throw new Error('SessionProvider 가 없습니다.');
  return s;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12, backgroundColor: T.bg }}>
      {children}
    </View>
  );
}

/**
 * 세션이 준비될 때까지 화면을 막는 게이트.
 *
 * 상태를 뭉뚱그리지 않는다 — "환경 미설정 / 로그인 필요 / 연결 실패"는 원인도 해결책도 다르다.
 * 하나로 합치면 사장님이 무엇을 해야 할지 알 수 없다(가이드 §9.8 Error).
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const s = useSession();

  if (s.phase === 'loading') {
    return (
      <SessionContext.Provider value={s}>
        <Centered>
          <ActivityIndicator size="large" color={T.blue} />
          <Text style={{ fontSize: 16, color: T.sub2, fontWeight: '600' }}>불러오는 중이에요</Text>
        </Centered>
      </SessionContext.Provider>
    );
  }

  if (s.phase !== 'ready') {
    const title =
      s.phase === 'unconfigured' ? '서버 연결 설정이 없어요'
      : s.phase === 'signed-out' ? '로그인이 필요해요'
      : '서버에 연결하지 못했어요';
    const hint =
      s.phase === 'unconfigured'
        ? 'apps/mobile/.env 에 Supabase 주소와 키를 넣어 주세요.'
        : s.phase === 'signed-out'
          ? '로그인하면 매장 데이터를 볼 수 있어요.'
          : '로컬 Supabase 가 켜져 있는지 확인한 뒤 다시 시도해 주세요.';

    return (
      <SessionContext.Provider value={s}>
        <Centered>
          <Text style={{ fontSize: 18, fontWeight: '800', color: T.ink, textAlign: 'center' }}>{title}</Text>
          <Text style={{ fontSize: 16, color: T.sub2, textAlign: 'center', lineHeight: 22 }}>
            {s.message ?? hint}
          </Text>
          {/* 환경 미설정은 재시도해도 달라지지 않는다 — .env 를 고쳐야 한다. 그때는 버튼을 숨긴다. */}
          {s.phase === 'unconfigured' ? null : (
            <Button kind="primary" size="lg" onPress={s.retry}>다시 시도</Button>
          )}
        </Centered>
      </SessionContext.Provider>
    );
  }

  return <SessionContext.Provider value={s}>{children}</SessionContext.Provider>;
}
