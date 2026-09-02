# AI-PLANS-SIM-CODEX-ULTRA-R3 — exact commit 증거 결속 재감사

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: `VERIFIED`
> 구현 대상: `c1b595f74f2fc7824b480bf8457e3026c0f1d6dc`
> 대상 tree: `1c4bfab16cf633d4b2106df0b58f488929d1508c`
> 기준 부모: `8ab364e3330bbd7205572279fb5a4d6b969e2a51`
> 재감사 시각: `2026-09-02T10:45:16+09:00`
> 계기: Fable `FNL-EVIDENCE-BINDING-001`·`FNL-VERIFY-EVIDENCE-002`·
> `FNL-CODEX-ROUND1-003`

## 1. 팀 구성안 해시 불일치의 원인

`AI-PLANS-SIM-CODEX-ULTRA-R2.md`는 커밋 직전 Windows 작업복사본의 CRLF bytes를 해시했다.
Git은 `.gitattributes` 규칙에 따라 commit에 LF bytes를 저장했다. 문서 내용 변경이 아니라 줄끝
정규화였지만, R2가 target commit bytes를 고정했다고 읽힐 수 있으므로 이 R3가 바로잡는다.

| 측정 | SHA-256 |
|---|---|
| 커밋 전 CRLF 작업복사본 | `FB695AC180F98C66EC9F5A2A3F4DCF863B32B238D6D5F2A6966F19D7B704296C` |
| 같은 bytes를 LF로 정규화 | `4E8F33E0023E21140739ADE1819130737FDDD574A9E91D0F1B4A83376A5D75BA` |
| `git show c1b595f:docs/팀구성_상세기획안.md` | `4E8F33E0023E21140739ADE1819130737FDDD574A9E91D0F1B4A83376A5D75BA` |

CRLF는 1,630개였고 LF 정규화 buffer와 Git blob은 byte 단위로 같다. 따라서 정책 문구의 감사 후
변경은 없었으나, R2의 팀 구성안 hash 주장은 target commit 증거로 사용하지 않는다.

## 2. target commit 원문 SHA-256 재고정

아래 값은 작업복사본이 아니라 `git show c1b595f:<path>`가 반환한 commit bytes를 직접 해시했다.

| 파일 | SHA-256 |
|---|---|
| 팀 구성안 | `4E8F33E0023E21140739ADE1819130737FDDD574A9E91D0F1B4A83376A5D75BA` |
| 온톨로지 | `8C0DE404951DD133C9757163BDC1F273759482F919392363CF2C10590A454111` |
| 오케스트레이션 | `83B14CBA83A919D32072C3DBB14E6FC4013B2E5DC2B61E7D6C706BA0D6986F9C` |
| 디렉터리·문서 신경망 | `059EBAAB6429035598D2EC876861107C555FD6C348C341267D2FF000C758AF48` |
| 품질·학습·자율성 | `1CCBE0DB830E11D3D6EA12EEF584BB3F014F2A51A7E565B8DFDD5C79A16AECFC` |
| 시뮬레이터 | `AA22F05BF6CF212FD659201B020B0DA30EB21F62C28823963136685647617476` |
| 적대 시험 | `F267D3A66F9981B89AE5C6AFA07A4FBFDFE150B77A11D85D68E8D5D888CA7042` |

`corepack pnpm ai:plans:simulate`는 이 후보 판본에서 59/59를 다시 통과했다. 이 검사는 가상
`VIRTUAL_SIMULATION`·`VIRTUAL_FIXTURE`만 만들며 실제 보호 원격이나 배포 증거를 주장하지 않는다.

## 3. Codex 1차·2차 증거 독립성

후속 Fable successor는 다음 세 증거를 모두 `evidence_paths`에 넣어 같은 이름의 재포장이 아닌지
직접 비교한다.

- `AI-PLANS-SIM-CODEX-R1.md`: 기본 업무 흐름·오류 흐름 중심 1차 검증
- `AI-PLANS-SIM-CODEX-ULTRA-R1.md`: 권위·요청·lease·Finding 경계 적대 검증
- `AI-PLANS-SIM-CODEX-ULTRA-R2.md`: 수명주기·경로·감사 역방향 공격

이 R3는 위 세 파일을 대체하거나 소급 수정하지 않고 target commit bytes와 외부 검증만 추가한다.

## 4. 검증 실행과 exact-SHA 원격 증거

공식 작업 루트에서 `PGDATABASE=fresh_ai_plans_check`와 Git Bash를 명시해 실행한
`corepack pnpm verify`는 다음과 같이 6/6을 통과했다.

- 타입 통과
- core·DB·mobile 시험 통과: DB 50/50, mobile 233
- CLI 계약·ACL 보안 통과
- 새 DB 전체 migration·2세션 경합·locale parity 통과
- 업그레이드 경로 23/23 통과
- 웹 Metro export 통과

이 로컬 실행은 사용자 미커밋 UI 파일이 함께 있는 공식 작업 루트였으므로 **exact clean commit
증거라고 단독 주장하지 않는다.** 정확한 구현 SHA `c1b595f`는 승인받아 원격 작업 브랜치에 별도로
푸시했고 GitHub Actions run `33582393050`가 같은 SHA를 검증한다.

<!-- exact-ci-result:start -->
- exact-SHA CI 상태: `SUCCESS`
- run: `https://github.com/Jacop7/cost/actions/runs/33582393050`
- 검증 SHA: `c1b595f74f2fc7824b480bf8457e3026c0f1d6dc`
- 완료 시각: `2026-09-02T02:23:57Z` (`2026-09-02T11:23:57+09:00`)
- Node 20.19.4: `SUCCESS`
- Node 24: `SUCCESS`
- full-db-required: `SUCCESS`
<!-- exact-ci-result:end -->

## 5. 결론

팀 구성안 해시 차이는 내용 변경이 아닌 CRLF→LF 정규화였고, target commit의 일곱 파일 SHA를
다시 고정했다. Codex 1차 증거 두 파일도 successor 입력에 포함한다. exact-SHA의 Node 20.19.4·
Node 24·`full-db-required`가 모두 성공했으므로 `FNL-VERIFY-EVIDENCE-002`의 수정 근거는 마련됐다.
다만 Finding 상태를 `VERIFIED` 또는 `CLOSED`로 바꾸는 권한은 최초 발견 역할의 유효한 후속 Fable
회차에만 있다. 네 후속 기획안은 계속 `DRAFT`이며 이 증거는 문서 활성화나 실제 디렉터리 생성을
승인하지 않는다.
