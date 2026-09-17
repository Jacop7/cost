# 세션·매장 캐시 소유권 검수 — 2026-09-14

## 발견과 영향

전역 QueryClient가 SessionGate 위에 있고 일부 조회 키가 사용자·매장 ID를 포함하지 않아,
인증 경계가 닫힐 때 캐시를 확실히 비워야 한다. 실제 useSession·SessionGate·useSalesDay 조합에서
다음 문제를 재현했다.

- 초기 매장 조회 중 로그아웃한 뒤 늦은 조회가 이전 사용자를 ready로 복구했다.
- 사용자 A에서 B로 바뀐 인증 이벤트를 기존 세션이 무시했다.
- 로그아웃 뒤 날짜 키의 판매 캐시가 남고 B가 A의 값을 잠시 보거나 A의 늦은 조회가 B 캐시에 들어갔다.
- 같은 사용자의 로그아웃→재로그인이 React 한 렌더로 합쳐지면 사용자·매장 문자열이 같아 기존 캐시를 승계했다.

이 경계는 다른 사용자의 매장·판매 정보가 화면에 나타날 수 있으므로 출시 전 차단 대상이다.
실제 계정 전환이나 사용자 데이터로 재현하지 않고 인증·조회 응답을 제어한 앱 시험만 사용했다.

## 수정 계약

useSession은 인증 세대를 관리하고 초기 getSession/getUser/매장 조회의 늦은 완료를 무시한다.
인증 콜백에서는 범위를 동기적으로 닫고 Supabase 재검증은 콜백 밖에서 예약해 인증 잠금을 기다리지 않는다.
다른 사용자와 같은 사용자의 로그아웃→재로그인은 새 세대로 구분한다. 같은 사용자의 TOKEN_REFRESHED는
기존 세대·입력·캐시를 유지한다.

SessionGate는 사용자·매장·세대를 소유자 키로 사용한다. 새 소유자의 하위 화면을 열기 전에
이전 쿼리를 취소하고 캐시를 비운다. 그 사이에는 로딩 화면만 표시한다. 전역 쿼리 키 전체 개편이나
루트 레이아웃 변경은 하지 않았다. 계정 탈퇴의 기존 캐시 정리 후 로컬 로그아웃 순서도 유지했다.

## 실행 증거와 판정

상세 SHA와 실행 명령은 [.codex manifest](../../../.codex/full-function-audit-20260914/session-scope-manifest.json)에 있다.

| 실행 | 결과 |
| --- | --- |
| 최초 통합 반례 | session-scope-before.log: 5실패·2통과 |
| 동일 사용자 묶음 전환 반례 | session-scope-batched-before.log: 1실패·18통과 |
| 수정 후 범위 | session-scope-after.log: 세션19·입고 scope41·계정11·매장 선택1, 총4파일72시험 통과 |
| 모바일 전체 | mobile-all-after-session.log: 136파일·1,630통과/4기존 제외 |
| 타입 | session-final-typecheck.log: 모바일 타입 검사 통과 |
| 실행 시작 입력 | mobile-after-session-before-inputs.json: 모바일 소스·시험·설정 451파일 SHA. 병행 UI 작업의 후속 변경은 별도 범위 검사로 연결 |

수정 제품은 session.ts와 SessionProvider.tsx 두 파일이다. queryClient.ts와 app/_layout.tsx는 manifest에
불변 SHA로 기록했다. quickInboundScope 시험은 Gate 입장이 비동기가 된 계약에 맞춰 실제 ready 요소를
기다리게 했고, 기존 RPC·저장소·소유권 단언은 유지했다.

해당 재현 경계와 관련 앱 회귀는 통과했다. 실제 운영 로그인 UI·가입·첫 매장 등록은 별도 구현 공백이다.
실제 기기 인증 전환, 최종 전체 verify, 정식 독립검수와 원격 배포는 아직 완료하지 않았다.
