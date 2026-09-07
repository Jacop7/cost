# P2 Opus 직접 자문 R1

- 범위: 읽기 전용 독립 검수
- 기준선: `41b8b5e2872b591b59d04e20ad6c88bc3e705462`
- 대상: `5cd55597dc1d464d514c81092e925b8facc3d03b`
- 모델: Claude Opus 5 High
- 판정: `CHANGES_REQUIRED`
- 성격: 사용자 요청에 따른 직접 자문이며 Fable 공식 판정 대체가 아니다.

## 확인된 보존 사항

- 제품 route·query·RPC와 저장 동작은 바뀌지 않았다.
- 대표 5화면의 변경은 헤더 공용화 범위이고, 접근성 상태와 행동 대상이 보존됐다.
- 시각 증거의 PNG·tree Git blob OID 20건은 diff와 일치했다.
- P1의 import graph 잔여 계약 6건은 구현과 음성 시험으로 닫혔다.

## Findings

| ID | 심각도 | Finding | 완료 조건 |
|---|---|---|---|
| M1 | Major | P0 검사가 `deferredUntilP2`만 허용해 P2의 active threshold와 모순 | stage P2 전이와 active threshold를 검사하고 checker hash 재고정 |
| M2 | Major | P0 제품 freeze가 P2 제품 변경 뒤 재측정을 차단 | 제품 변경 commit과 분리한 rebaseline commit에 새 HEAD 측정과 old/new failure 차집합 보존 |
| M3 | Major | `HubHeaderAction`이 터치 감사기의 정적 계약 밖으로 이동 | 실제 Pressable 44dp, 내부 시각 상자 40dp, 공용 컴포넌트 계약, known 목록 재기준화 |
| M4 | Major | S3A·S4·TOUCH exact 출력이 이동했으나 기준선은 옛 출력 | M2 rebaseline에서 세 게이트·분류·backlog를 양방향 재측정 |
| M5 | Major | responsive 20건이 승인 manifest 값과 정확히 대조되지 않음 | capture와 manifest의 키별 완전 비교 및 임의 양수 높이 음성 시험 |
| m1 | Minor | safe-area 시험이 `useSafeAreaInsets` 경로를 통과하지 않음 | 실제 SafeAreaProvider가 소비하는 inset을 주입 |
| m2 | Minor | 영어 부제·숫자 행간·세로 잘림·텍스트/버튼 겹침을 검사하지 않음 | 모두 직접 관측하고 0을 단언 |
| m3 | Minor | 전체 viewport 캡처가 로컬 DB 내용에 의존 | 헤더 전용 data plane과 재현 서버 명령을 manifest에 결속 |
| m4 | Minor | SALES 아이콘의 상단 정렬 이동이 승인 prop 목록에 없음 | `actions.alignSelf`를 명시적 승인 변화로 기록 |
| m5 | Minor | subtitle TYPE 혼합, 23px 아이콘, dot 리터럴이 3계층 토큰 계약을 벗어남 | caption 역할 일체화, iconSize 24, dot component token 사용 |
| m6 | Minor | packages graph가 루트 tsconfig의 inherited wildcard alias를 놓칠 수 있음 | 루트 alias를 함께 해석하고 음성 시험 |
| m7 | Minor | `pathsBasePath`와 `baseUrl` 우선순위가 TypeScript와 반대 | `baseUrl ?? pathsBasePath`로 수정 |
| m8 | Minor | 시각 baseline 디렉터리의 미지정 확장자가 무규칙 | 디렉터리 catchall binary 후 txt만 LF 예외 |

## 진입 경계

P2의 수정 exact SHA가 다시 독립검수에서 PASS하기 전에는 P3에 진입하지 않는다. CI 필수 범위에 어떤
3표면 게이트를 연결할지도 P3 확대 전에 확정한다.
