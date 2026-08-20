/**
 * 서버 데이터 화면의 상태 분기 — Loading / Error / Empty (가이드 §9.8).
 *
 * 세 상태를 뭉뚱그리면 사장님이 무엇을 해야 할지 모른다:
 *   · 로딩 중인데 "데이터가 없어요" 를 먼저 보여주면 없는 줄 안다
 *   · 통신 실패인데 빈 목록을 보여주면 정말 비었다고 오해한다
 *   · 검색 결과 0건과 최초 데이터 0건은 다음 행동이 다르다
 *
 * 이 컴포넌트는 그 분기를 한 곳에 두어 화면마다 복제되지 않게 한다.
 */
import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from './index';
import { T } from '@/theme/tokens';

function Box({ children }: { children: ReactNode }) {
  return (
    <View style={{ paddingVertical: 48, paddingHorizontal: 32, alignItems: 'center', gap: 10 }}>
      {children}
    </View>
  );
}

export function QueryState({
  isLoading,
  error,
  isEmpty,
  onRetry,
  emptyTitle,
  emptyHint,
  loadingLabel = '불러오는 중이에요',
  children,
}: {
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  onRetry?: () => void;
  emptyTitle: string;
  emptyHint?: string;
  loadingLabel?: string;
  children: ReactNode;
}) {
  // 로딩이 먼저다. 로딩 중에 Empty 를 보여주면 없는 줄 안다(§9.8 Loading).
  if (isLoading) {
    return (
      <Box>
        <ActivityIndicator size="large" color={T.blue} />
        <Text style={{ fontSize: 16, color: T.sub2, fontWeight: '600' }}>{loadingLabel}</Text>
      </Box>
    );
  }

  if (error) {
    // 내부 오류 코드·테이블명을 그대로 노출하지 않는다(§9.2). 다음 행동을 알려준다.
    return (
      <Box>
        <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, textAlign: 'center' }}>
          정보를 불러오지 못했어요
        </Text>
        <Text style={{ fontSize: 14, color: T.sub2, textAlign: 'center', lineHeight: 20 }}>
          입력한 내용은 그대로예요. 잠시 후 다시 시도해 주세요.
        </Text>
        {/*
          ⚠ 개발 중에는 **무엇이 터졌는지** 화면에 그대로 보여 준다.
            react-query 는 queryFn 이 던진 예외를 상태로 삼켜서 콘솔에 아무것도 안 남긴다.
            그래서 "정보를 불러오지 못했어요"만 뜨고 원인을 찾을 단서가 없었다 —
            서버·네트워크를 한참 뒤진 뒤에야 클라이언트 예외인 걸 알았다(실측).
            사용자 빌드에서는 내부 메시지를 노출하지 않는다(가이드 §9.2).
        */}
        {__DEV__ && error ? (
          <Text
            selectable
            style={{
              fontSize: 12, color: T.red, textAlign: 'center', lineHeight: 17,
              paddingHorizontal: 12, fontFamily: 'monospace',
            }}
          >
            {error instanceof Error ? `${error.name}: ${error.message}` : String(error)}
          </Text>
        ) : null}
        {onRetry ? <Button kind="primary" size="md" onPress={onRetry}>다시 시도</Button> : null}
      </Box>
    );
  }

  if (isEmpty) {
    return (
      <Box>
        <Text style={{ fontSize: 16, color: T.ter }}>{emptyTitle}</Text>
        {emptyHint ? <Text style={{ fontSize: 14, color: T.ter, textAlign: 'center' }}>{emptyHint}</Text> : null}
      </Box>
    );
  }

  return <>{children}</>;
}
