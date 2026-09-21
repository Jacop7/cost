# TEAM-SERVICE P2 입장 비차단 보강 003

## 목적

Fable 직접 재검수 002가 `PASS`와 P2 구현 가능 판정을 내린 뒤 요청한 비차단 기록 보강이다. 이미 검수된 실패 처분002와 봉인 후보005를 수정하지 않고 추가 사실만 기록한다.

## 전체 검증 DB 실패 파일 목록

`TEAM-SERVICE-VERIFY-P2-ADMISSION-20260906-001.json`의 raw stdout에서 개발 DB 시험 실패 파일은 다음 여덟 개다.

- `01_checksums.sql`
- `04_ledger.sql`
- `08_write_paths.sql`
- `14_post_hardening.sql`
- `17_multi_tenant.sql`
- `22_tax_profiles.sql`
- `27_internationalization.sql`
- `28_locale_parity.sql`

처분002의 3개 항목은 대표 실패 원인 묶음이지 실패 파일의 완전 목록이 아니다. 특히 `04_ledger.sql`의 870g 대 869g 불일치는 직전 43/50 관측에서 42/50으로 악화된 신규 차이다. 어떤 실패도 P2 입장으로 면제되지 않는다.

## 입력 inventory 한계

전체 검증 수집기는 594개 입력을 해시로 대조했지만 `docs/**` 전체와 `.codex/team-router/**` 전체를 명시적으로 포괄하지 않는다. 별도의 완전 inventory companion도 없다. 그러므로 `changed_inputs=[]`는 수집기 대상만 불변이라는 뜻이다.

## TAP 의미론 한계

P2-005 companion은 raw TAP의 SHA와 실행 입력을 결속하지만, TAP 원문 자체가 모든 `kind`, `profile_id`, module hash, allowlist, snapshot pin을 독립적으로 반복하지는 않는다. companion과 TAP을 함께 읽어야 하며 이는 provider/host attestation이 아니다.

## 다음 재봉인 한계

후보005의 `input_refs`는 P2-004 요약 증거 중심이다. 이후 새 후보를 봉인한다면 P2-005 raw/companion, 실패 처분, 본 보강을 직접 pin해야 한다. 이 보강은 `service_ready=false`, 전체 검증 실패, 실제 send·Router·제품·DB 변경 차단을 바꾸지 않는다.
