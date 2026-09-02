# AI 팀·지식 신경망 컨텍스트 전환 학습 패킷

> 기준 요청: 2026-09-01 화요일 22:07 KST 무렵의 “디렉터리 재설계 및 팀 구성안 설정” 요청부터
> 현재까지의 결정·작업·미완료 상태를 새 채팅이 복원하기 위한 비권위 학습 자료다.
> 공식 정책은 반드시 아래 연결된 원문과 저장소의 실제 코드·시험을 다시 읽어 판정한다.

## 1. 시작 요청과 목표

사용자는 다음 문제를 하나의 시스템으로 설계해 달라고 요청했다.

- `docs/팀구성_상세기획안.md`를 확정한다.
- AI 팀이 효율적으로 협업하도록 디렉터리 경계를 재설계한다.
- 여러 채팅에서 작업해도 현재 맥락과 과거 작업을 빠르게 복원한다.
- 작업 히스토리가 단순 보관물이 아니라 검증된 Learning으로 성장한다.
- 마스터 오케스트레이션, 부 오케스트레이션, Context & Token Steward, 제품·데이터·운영·품질·지식 팀의
  책임과 채팅 경계를 정한다.
- 팀별 Markdown을 적소에 배치하되 경쟁 권위와 무제한 컨텍스트 복제를 만들지 않는다.
- 완성된 구조를 다른 프로젝트에도 이식할 수 있는 AI 팀 운영 스타터 키트로 발전시킨다.

사용자가 비유한 목표 구조는 “여러 신경망으로 둘러싸인 구가 다른 구 및 위성과 연결되는 입체적
네트워크”다. 구현 언어로는 중앙 권위, 역할별 투영, Task Graph, HANDOFF, append-only 감사 원본,
검증된 Learning과 탐색 링크가 결합된 구조를 뜻한다.

## 2. 공식 문서망

다음 다섯 문서가 현재 설계의 공식 원문이다. 검수 증거나 이 파일로 대체하지 않는다.

1. [`팀구성_상세기획안.md`](../../팀구성_상세기획안.md) — 역할·팀·사람 승인·검수 책임의 최상위 권위
2. [`AI-지식-온톨로지-기획안.md`](../../AI-지식-온톨로지-기획안.md) — node·edge·요청 판정·HANDOFF 의미
3. [`AI-오케스트레이션-상세기획안.md`](../../AI-오케스트레이션-상세기획안.md) — 요청 수신·라우팅·다중 채팅·작업 흐름
4. [`디렉터리-문서신경망-재설계-기획안.md`](../../디렉터리-문서신경망-재설계-기획안.md) — 물리 경로·가까운 README·그래프 검사·이동 계약
5. [`AI-품질-학습-자율성-평가기획안.md`](../../AI-품질-학습-자율성-평가기획안.md) — 평가·Learning·자율성 승격/강등

공동 검수 규격은 [`docs/ai-review/README.md`](../README.md), 현재 실행점과 완료 기록은
[`docs/작업큐.md`](../../작업큐.md), 제품·DB·배포의 기존 권위는 루트 `AGENTS.md`가 연결한다.

## 3. 합의된 팀·채팅 모델

### 부서 그룹

1. `00 모든 팀 상황실`
2. `01 Product · Mobile`
3. `02 Data · Backend`
4. `03 Platform · Operations`
5. `04 Quality · Review`
6. `05 Knowledge · Orchestration`

### 마스터 운영 채팅

1. `00 마스터 오케스트레이션`
2. `01 부 오케스트레이션 · 토큰/컨텍스트 관리`
3. `02 통합 작업큐 · 사람 결정`
4. `03 개발 서버 · 배포 테스트`
5. `04 운영 배포 · 복구 게이트`

부서·마스터 채팅은 라우팅과 상황 공유 표면이다. 장기 구현은 한 Task·한 편집 소유자·한 임시 작업
채팅에서 수행한다. 모든 채팅에 모든 역할을 상주시켜 컨텍스트를 복제하지 않는다. 모든 팀이 알아야 할
사건은 상황실에 요약 링크로 올리고, 공식 상태는 저장소의 Task·Decision·Finding·HANDOFF가 소유한다.

## 4. 토큰·컨텍스트 관리 결정

- Context & Token Steward는 토큰 압력·중복·검색 실패·handoff 필요성을 관측하고 신호만 낸다.
- Steward는 범위·비용·정책·검수·배포를 승인하지 않는다.
- 새 채팅 전환은 `rollover → checkpoint → HANDOFF → 복원 검증 → lease 인계` 순서를 따른다.
- 채팅 전체를 복사하지 않는다. L0 헌법, L1 현재 실행점, L2 직접 권위, L3 1-hop 증거, L4 조건부 원시
  이력 순으로 필요한 정보만 조립한다.
- 같은 또는 낮은 HANDOFF 판본, 다른 source SHA, 바뀐 Task snapshot, 사람 인계 결정 없는 lease 인수는
  거부한다.
- 대화는 기억의 원본이 아니다. 저장소에 봉인되지 않은 자기보고는 공식 완료 증거가 아니다.

## 5. 검수 정책의 최신 결정

사용자는 “Fable을 모든 검수에 필수로 사용하되 금액·토큰은 최소화”하라고 확정했다. 이에 따라:

- R0~R3는 Fable 호출 여부가 아니라 검수 깊이와 전문 역할만 바꾼다.
- Codex 실행 검증과 Fable 독립 검수는 서로 대체하지 않는다.
- Fable 비용은 문서별 원문 한 개, target commit/tree, content hash, 기계 생성 교차계약 투영으로 줄인다.
- 문서별 검수는 최종 네트워크 closure가 아니다.
- Opus 결과는 `OPUS_DIRECT_ADVISORY` 또는 허용된 fallback provenance로만 기록한다.
- Opus는 작업 연속성을 도울 수 있지만 Fable PASS·게이트 종결·Task 완료를 대신하지 않는다.
- 실패·rate limit·budget exhaustion은 원본을 보존하고 PASS로 합성하지 않는다.

이 정책은 커밋 `446be65`에 반영됐고 compact evidence는 `96e1963`에 재결속됐다.

## 6. 구현·시뮬레이션 상태

- 실행형 문서 네트워크 시뮬레이션: `corepack pnpm ai:plans:simulate`
- 현재 결과: 70/70 PASS
- 검증 범위:
  - 탐색망 강연결과 권위 DAG 비순환
  - 요청 disposition hash chain과 Task 복원
  - 편집 lease·stale writer·잠금 순서
  - 실패 Fable run 보존과 Finding 재검수
  - Codex 2회·Fable 2회·사람 승인 전 활성화 금지
  - 디렉터리 materialization과 Learning 승격 조건
  - HANDOFF 단조 판본·분기 거부·원본 불변
  - 조건부 Fable, Codex-only 종결, Opus 대체 종결 사보타주 차단
- `corepack pnpm verify --no-db`: 4/6 통과. DB·업그레이드 단계는 실행하지 않았으므로 전체 통과로
  표현하지 않는다.
- Fable 실행기 self-test: 50개 묶음, protocol 1.2 fallback 계약 22/22 통과.

## 7. Fable·Opus 검수 이력과 현재 상태

- 이전 묶음 Fable 시도에는 유효 결과 없는 비용 소진 실패가 있었고 원본이 보존돼 있다.
- `AI-PLANS-V02-ONTOLOGY-003/r001`은 유효 `CHANGES_REQUIRED`였고 Major 3건을 설계·시험에 반영했다.
- `AI-PLANS-V02-ONTOLOGY-005/r001·r002`는 세션 제한 전 `MODEL_RATE_LIMITED`, 비용 0으로 실패해 OPEN이다.
- 과거 팀 구성안 PASS 뒤 Fable 필수 범위가 바뀌어 팀 문서 blob도 바뀌었으므로 옛 PASS를 현재 판본에
  재사용하지 않는다.
- CRLF 작업 폴더 바이트로 `agents_sha256`을 계산한 첫 successor 네 개는 실행 전 정적 검사에서 잡았다.
  task.json과 append 이력을 수정하지 않고 실패 준비 원본으로 보존했다.
- commit blob 기준 SHA-256으로 고친 다음 작업들이 준비돼 있다.
  - `AI-PLANS-V02-TEAM-POLICY-002`
  - `AI-PLANS-V02-ORCHESTRATION-003`
  - `AI-PLANS-V02-DIRECTORY-003`
  - `AI-PLANS-V02-QUALITY-003`
- 이 네 작업의 검수 대상은 `96e1963899862789717f2003e29ced2f1a393c64`, tree는
  `2613325c820dbfa5d3957fe5bf5d1dc12ffcbe70`이다.
- compact evidence는 [`AI-PLANS-V02-FABLE-COMPACT-EVIDENCE.md`](./AI-PLANS-V02-FABLE-COMPACT-EVIDENCE.md)다.

## 8. 현재 Git 상태와 보호 경계

- 공식 작업 루트: `C:\Users\jacop\프로젝트\식자재관리앱`
- 브랜치: `codex/ai-team-knowledge-orchestration-plans`
- 이 패킷 작성 직전 HEAD: `99ad3d9`
- 최근 핵심 커밋:
  - `446be65` — 모든 완료 검수 Fable 필수 정책
  - `96e1963` — compact evidence 재결속
  - `08fc72f` — 최초 후속 검수 작업 준비
  - `99ad3d9` — commit blob 해시 기준으로 후속 작업 교정
- 아직 push하지 않는다. main 병합·배포도 하지 않는다.
- 사용자 소유 변경은 절대 스테이징·수정·삭제하지 않는다.
  - `apps/mobile/src/components/kit/*`와 여러 화면 파일
  - `apps/mobile/src/theme/tokens.ts`
  - `apps/mobile/src/lib/appAlert.ts`
  - `scripts/prototype_server.py`
  - `.codex-share/`, `.tmp/`
  - `docs/prototypes/*`
  - `docs/ai-review/tasks/PROTOTYPE-TERMINOLOGY-001/`

## 9. 새 채팅의 학습 순서

새 채팅은 즉시 수정부터 시작하지 않고 다음 순서로 읽기 전용 스터디를 수행한다.

1. 현재 루트 `AGENTS.md`와 `git status`, branch, HEAD를 확인한다.
2. 이 패킷을 읽고 사용자 목표·보호 경계·현재 실행점을 요약한다.
3. 다섯 공식 기획안의 metadata, 중앙 권위 표, 상호 참조와 미결 결정을 읽는다.
4. `docs/작업큐.md`의 `AI-ORCH-PLANS-SIM-1`을 현재 실행점으로 복원한다.
5. compact evidence와 준비된 Fable/Opus Task의 target SHA·tree·AGENTS blob·artifact 경계를 대조한다.
6. 시뮬레이션 70/70을 재실행하고, 실패하면 제품 규칙을 약화하지 말고 원인을 진단한다.
7. 사용자 소유 변경과 공식 작업 범위가 겹치지 않는지 확인한다.
8. 읽은 근거와 다음 최소 작업을 비권위 스터디 결과로 보고한다.

## 10. 다음 실행 순서

현재 사용자 요청은 새 채팅에서 먼저 전체 구조를 스터디하는 것이다. 스터디가 끝난 뒤 작업은 다음 순서를
유지한다.

1. 유효한 온톨로지 closure 검수
2. 팀 정책 검수
3. 오케스트레이션 검수
4. 디렉터리·문서 신경망 검수
5. 품질·학습·자율성 검수
6. 각 유효 review/run/input hash와 다섯 문서 content hash를 결속한 최종 네트워크 검수
7. 열린 Finding 반영·재검수
8. 사람 최종 승인
9. 승인 뒤 실제 Markdown·디렉터리 materialization
10. 문서 그래프 검사기를 `pnpm verify`에 연결
11. 작은 코드 디렉터리 파일럿
12. 실제 구조 검증 후 AI 팀 운영 스타터 키트와 브랜치·DB·서버 adapter에 환류

## 11. 새 채팅이 하면 안 되는 일

- 이 패킷만 보고 문서가 검수·확정됐다고 선언하지 않는다.
- 이전 채팅의 말이나 요약을 코드·문서·시험보다 우선하지 않는다.
- 사용자 소유 변경을 정리·원복·커밋하지 않는다.
- 실패 Fable/Opus 결과를 PASS로 바꾸지 않는다.
- 같은 입력으로 외부 검수를 반복해 토큰을 소진하지 않는다.
- 승인 없이 비용 상한 증액, push, main 병합, 스테이징·운영 배포를 하지 않는다.
