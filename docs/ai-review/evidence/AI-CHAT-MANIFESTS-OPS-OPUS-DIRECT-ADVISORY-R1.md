# 채팅 manifest·운영 기준선 Opus 자문 r1

> 상태: `OPUS_DIRECT_ADVISORY`
> 실행일: 2026-09-04 Asia/Seoul
> 대상: `6497666e655609a4f4bfe10bfaea6070dad01286`의 working tree
> 모델: `claude-opus-5` · medium effort · Claude Code `2.1.250`
> 권위 제한: 이 자문은 Fable 공식 독립검수·보호 원격 게이트·Fable failure successor를 대체하지 않는다.

## 실행 이력

- 읽기 전용 시도 1: `$0.490015`, `max_turns`, verdict 없음.
- 읽기 전용 시도 2: `$0.644952`, 사용자가 편집 권한을 요청해 `aborted_streaming`, verdict 없음.
- 편집 자문 r1: `$1.1304955`, `completed`, `CHANGES_REQUIRED`.

세 번째 호출은 `Read`, `Glob`, `Grep`, `Edit`, `Write`만 허용했고, 원격·명령 실행·DB·GitHub·Supabase·
브랜치·파일 삭제·이름 변경과 지정 범위 밖 파일 변경을 금지했다.

## 범위와 판정

검토 범위는 11개 `docs/team/chats/*.md`, team context 문서, generic manifest template, setup doctor·문서
그래프 검사기와 시험, 운영 cron/RPC 문서다.

- 11개 manifest의 bodyless exact 11-field, context registry 결속, 권위 비상승은 확인됐다.
- 문서 그래프의 12번째 manifest·본문·추가 field·미등록 context·route 권한 상승 거부는 확인됐다.
- production DB 0191 적용, production Edge 자동 관측 미배포, staging-only ops-health 표기는 구분되어 있다.
- `scripts/setup-doctor.mjs`에서 필수 파일이나 디렉터리가 없는 checkout이 중간 `ENOENT` 예외로 종료할 수
  있던 P2를 발견했다.

## 반영한 P2

`readTextOrNull`과 `listEntries`를 사용해 `.npmrc`, 모바일 환경 예시, upgrade script, migration·DB 시험·
deployment directory, 정적 계약 파일을 읽을 수 없을 때 기존 FAIL 결과로 떨어지게 했다. PASS 경로를
추가하지 않았으며 원격·비밀·project ref 처리에는 변화가 없다.

`scripts/setup-doctor.test.mjs`에 최소 checkout fixture가 예외 대신 `NOT_READY`/FAIL 보고서를 만드는
회귀시험을 추가했다.

## 남긴 P3

문서 그래프의 exact manifest 파일 집합은 `.md` 파일만 계약 대상으로 삼는다. `.mdx`·`.markdown` 또는
하위 디렉터리의 경쟁 파일까지 모두 거부할지는 현재 공식 manifest 확장자 계약을 넓히는 판단이므로
이번 자문에서는 변경하지 않았다.

## 검증

- `node --test scripts/setup-doctor.test.mjs` — 7/7 PASS
- `node --test scripts/docs-graph-check.test.mjs` — 22/22 PASS
- `node scripts/docs-graph-check.mjs --activation` — PASS
- `node scripts/setup-doctor.mjs` — `READY_LOCAL_NO_DB`, PASS 16 / WARN 3 / FAIL 0
- `corepack pnpm verify --no-db` — 4/6 PASS; Docker 미실행으로 새 DB·upgrade는 미실행
- `git diff --check` — PASS
