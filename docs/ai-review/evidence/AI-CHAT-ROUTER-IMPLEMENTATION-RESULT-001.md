# Team Router 구현·설치 결과 001

> 완료일: 2026-09-04
> 결정: `DEC-TEAM-ROUTER-DISPATCH-001`
> 범위: `ACTIVE_IMPLEMENTATION_ONLY`
> 실제 dispatch/relay/새 채팅 생성: 없음
> 설치 버전: `0.1.0+codex.20260903192424`
> marketplace: `team-router-local`
> 상태: installed, enabled

## 구현 결과

- 11개 chat manifest를 schema v2로 올리고 21개 directed edge·12개 message kind를 고정했다.
- `.codex/team-router/policy.json`은 `SIMULATION_ONLY`, dispatch/relay false다.
- 별도 `C:\Codex-AI-Operations\Codex-Team-Router` 플러그인을 만들고 전역 설치했다.
- route별 canonical JSONL, hash chain, exclusive lock, CAS, prepared crash recovery, dedupe를 구현했다.
- Mission Relay handoff·successor·restore·Study Gate 실파일과 sidecar hash를 검증한 뒤에만 endpoint
  generation CAS 후보를 만들며, 현재 구현-only policy에서는 실제 활성화를 차단한다.
- 공통 스타터 키트에 Chat Manifest v2와 무발송 Team Router policy 템플릿을 역반영했다.

## 실행 증거

- Team Router unit/sabotage: `31/31 PASS`
- skill validator: `PASS`
- plugin validator: `PASS`
- current project policy: `POLICY_VALID · SIMULATION_ONLY`
- current project manifest: `11 chats · 21 edges · PASS`
- docs graph: `26/26 PASS`, activation graph `PASS`
- starter kit: `3/3 PASS`
- no-send pilot: `6 routes · 30 events · messageSent=false`
- `corepack pnpm verify --no-db`: `4/6 선택 범위 PASS`
- `corepack pnpm verify`: `4/6`; ②·④ DB 범위 실패, 나머지 ①·③·⑤·⑥ PASS

전체 verify 실패는 이 Task가 수정하지 않은 DB 기준선에서 발생했다. 공유 DB 시험은 `44/50`으로
순이익 기대값 `4046.69` 대 현재 공식값 `4046.60`, 국제 세금 활성 뒤 기타매출 채널 필수 계약 등이
재현됐다. fresh DB 단계는 대상 DB가 생성되지 않아 `0/50`이었다. 라우터 구현은 제품 코드·migration·
Supabase 연결을 수정하지 않았으며 이 결과를 전체 PASS로 표현하지 않는다.

## Fable

- R1: `$3.366744`, `READY_FOR_IMPLEMENTATION_ONLY`, Medium 4·Low 6
- R2: `$2.024283`, FTR-001~010 전부 `CLOSED`, 차단 Finding 0
- 누적: `$5.391027`
- R2의 신규 Low FTR-011은 resolve 전 symlink·Windows reparse component 검사로 즉시 보강하고
  31/31을 재통과했다.

정식 Fable runner는 Claude Code `2.1.259`가 현재 allowlist에 없어 모델 호출 전에 차단된다. 위 판정은
직접 읽기 전용 advisory이며 공식 protocol PASS·보호 gate CLOSED·실제 dispatch 승인이 아니다.

## 설치 캐시

| 파일 | SHA-256 |
|---|---|
| `scripts/team_router.py` | `7b34c87e550b0a16a8f2fd1fbc475d3194ca00c73a218153c52c2fcb6ac12486` |
| `skills/team-router/SKILL.md` | `4d37860b6764e981daf803926cf03084e40a8e1eb8bd270aee1b88c6bd08157b` |
| `.codex-plugin/plugin.json` | `35776cf0b4eafde94ba6cd670673b87bf7c43a253f0fc10317b4f42e173a17da` |

세 파일 모두 source와 설치 cache가 동일했다. 새 작업이나 Codex 재시작 뒤 새 skill을 로드한다.
