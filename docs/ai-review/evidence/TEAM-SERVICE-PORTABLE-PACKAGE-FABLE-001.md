# 휴대형 AI 팀 서비스 구성 Fable 자문 001

## 성격

- 채널: 기존 `AI 팀 지식망 스터디·인계` Fable Cowork 채팅
- 입력: 사용자 제안 8요소와 기존 4개 플러그인 독립 유지 제약
- 판정: `CHANGES_REQUIRED`
- 한계: 직접 Fable Cowork 자문이며 formal CLI receipt, 구현 승인, 발송 승인이 아니다.

## 차단 finding

1. `B-1`: doctor가 capability tier를 표시만 하지 말고 근거 hash와 함께 봉인하고 전체 제품이 이를 강제해야 한다.
2. `B-2`: 기존 4개 플러그인의 version·소비 schema·불일치 처분 compatibility matrix가 필요하다.
3. `B-3`: plugin, 생성 파일, runtime 초기화, doctor, tier를 묶은 재검산 가능한 install receipt가 필요하다.
4. `B-4`: simulation 정책 값만으로는 부족하며 AC-24형 closure pin·금지 import·fake transport·0/0 무발송 harness가 필요하다.
5. `B-5`: candidate, 검수, 사람 Decision, epoch를 묶는 exact-SHA activation envelope와 PROBE_ONLY→PILOT 분리가 필요하다.
6. `B-6`: PowerShell/Bash 실제 marker·exit, Node/Python, VM module, Unicode·CRLF 실행환경 probe가 필요하다.
7. `B-7`: init 직후 역할 manifest와 허용 edge의 requirement coverage 자가감사가 필요하다.

## 경계 판정

초기 1번의 `역할·라우팅·인계·토큰 경계 제공`은 기존 플러그인 책임과 중복된다. 새 플러그인은
다음을 직접 구현하지 않고 참조·검증·조합만 해야 한다.

- Mission Relay: 채팅별 1.7, HANDOFF, 복원, Study Gate
- Project Orchestrator: 모델·추론·검수·가중 토큰 계획
- Team Router: edge, dedupe, endpoint generation, dispatch activation
- Account Continuity: 동일 소유자 계정군과 계정 전환 영수증

삭제 후에도 기존 4개 플러그인이 독립적으로 같은 의미로 동작해야 한다.

## 필수 acceptance

Fable은 clean install, cross-PC deterministic output, secret/endpoint/absolute-path leak zero,
no-send 0/0, tier fail-closed, Shell probe, dependency incompatibility rejection, migration roundtrip,
adapter coverage, exact-envelope ACK-only probe를 최소 시험으로 요구했다.

## 제품 문구

host identity/receipt가 없을 때는 `UNVERIFIED/OBSERVED/ATTESTED`를 구분한다. `LOCAL_CORE_ONLY`는
발송 0, `COOPERATIVE_OBSERVED`는 축소 신뢰 Decision 뒤의 관측 왕복만, `AUTHENTICATED`는 새 양성 host
scope가 증명한 범위만 허용한다. `완전 자동 왕복`은 AUTHENTICATED 외에서 금지한다.

## 반영 후보

위 finding은 다음 v0.1 설계 후보에 반영해 exact 파일 재검수를 요청한다.

- `docs/ai-team-starter-kit/PORTABLE-TEAM-SERVICE-ARCHITECTURE.md`
- `docs/ai-team-starter-kit/REBUILD-BLUEPRINT.md`
- `docs/ai-team-starter-kit/PLUGIN-OPERATIONS.md`
- `docs/ai-team-starter-kit/portable-package-contract.json`

