# AI-REVIEW-2-FALLBACK-CONTINUITY-001 공동 작업 장부

> 이 장부는 페이블 소진 시 Opus 연속성 경로와 protocol 1.2 감사 계약을 솔라와 페이블이 함께
> 개선하는 append-only 기록이다. 직접 편집은 이 최초 패킷 작성까지만이며 이후 턴은
> `corepack pnpm fable:append` 또는 검수 실행기로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `4eadc9a185204ae8bf27a69cd9c40f25e0ed05ba`
- artifact_hashes: `[{ path: package.json, sha256: 0aee1633e6aec37c59f67eb17ae8d7cb15d9db1529039ab1e6f2c94acf1e440f, change_type: MODIFIED }, { path: scripts/fable-review.mjs, sha256: 1d96769d27726c4be3ccda4efc43d9d900b8a426178e9adf632e843d92c6f2b3, change_type: MODIFIED }, { path: scripts/fable-review/protocol-v12.mjs, sha256: 40a2980f0bdb7c8a84b25e68be6192e1da07f2e57235fcc3978fa8f3bfac20d9, change_type: ADDED }, { path: scripts/fable-review/protocol-v12.test.mjs, sha256: 3976de76a583956fdf566f1a8a607200e4cc391648291b60e705ca63ded7e712, change_type: ADDED }, { path: docs/ai-review/README.md, sha256: ce257243aa8a75870a8baf116e17e0082a8bb8d430b4574a6d068dbcbda04ca4, change_type: MODIFIED }, { path: docs/ai-review/templates/task-v12-primary.example.json, sha256: 300267f35593db039c460017174488b135d7d34d79731db80c64834d402abdcf, change_type: ADDED }, { path: docs/ai-review/templates/task-v12-fallback.example.json, sha256: c784477e8ca3d75a53c1a1078580533887e09d2835f6f0d54e479d6a6920aff8, change_type: ADDED }, { path: docs/팀구성_상세기획안.md, sha256: 8aab0c13ddc0ea5663c9d667112b262960261a79a5c59f0853a7762b605a6789, change_type: MODIFIED }, { path: docs/작업큐.md, sha256: 4a31fdaa137ec6a61095b64e919168356a6cac73c801e01def03c3ec63c7c208, change_type: MODIFIED }]`
- changed_artifact_paths: `package.json`, `scripts/fable-review.mjs`, `scripts/fable-review/protocol-v12.mjs`, `scripts/fable-review/protocol-v12.test.mjs`, `docs/ai-review/README.md`, `docs/ai-review/templates/task-v12-primary.example.json`, `docs/ai-review/templates/task-v12-fallback.example.json`, `docs/팀구성_상세기획안.md`, `docs/작업큐.md`
- 충족해야 할 요구사항·불변식: `AI-REVIEW-2-1..6`, Fable primary, append-only audit, 작업 전체 4.00 USD 상한, P0-2 전 CLOSED 금지
- 이번에 바꾼 내용: protocol 1.2 task/result 계약, Fable→Opus 구조화 소진 fallback, 엔진 출처와 비용 승계, handoff-only source 검증, closure 구조 검증과 P0-2 전 실행 중단을 추가했다.
- 집중 검토 질문: 비승계 오류나 일반 예산 초과가 Opus 전환으로 위장될 수 있는가? 실패 run·장부·Finding registry·산출물·사용액 중 하나를 바꿔도 successor가 통과하는가? Opus 결과가 Fable 또는 CLOSED 근거로 위장될 수 있는가? protocol 1.1 원본 호환성이 깨지는가?
- 실행한 테스트·현재 증거: `fable:self-test` 35개 묶음, protocol 1.2 계약 18/18, `fable:check`, `corepack pnpm verify` 6/6 통과. 전체 verify는 DB 32/32·경합·parity·업그레이드 8/8·웹 번들을 포함한다.
- 사람 결정이 필요한 항목: 없음. 사용자는 기존 Max CLI 세션과 작업 전체 4.00 USD 상한을 승인했고 Opus는 실제 소진 때만 사용한다.
- next_review_request: `FABLE_REVIEW`
