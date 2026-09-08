# 재부팅 체크포인트 — 2026-09-09

## 재개 위치

- 권위 저장소: `C:/Users/jacop/프로젝트/식자재관리앱`
- 이 미션 작업 worktree: `C:/Users/jacop/프로젝트/식자재관리앱/.tmp/prototype-expo-parity-r2`
- 브랜치: `codex/prototype-expo-parity-r2`
- 제품 커밋: `7caebadcf7a2a13c1f32971f42375f8914b7280c`
- 직전 기록: `2c20851` (Sol 사용량 차단)
- 이 체크포인트 커밋은 제품 수정 없이 준비 스크립트와 재개 지침만 보존한다.
- 기본 작업 폴더는 다른 작업이 사용하므로 checkout/reset/clean/stash/pop하지 않는다.

## 현재 상태

P3 진행 중. 메뉴 월평균 입력·행·탭·정렬 폐기 정정과 PriceSim 제한 범위 검수는
`62495ed` 기록 참조. DB 기존 값과 실제 30일 판매량은 유지했다.
발주 ORD-01 옵션 소실 자동 fallback 안전 보정은 `7caebad`에 보존했다.
자체 시험 5/5·타입 PASS지만 Sol 검수 호출이 usage limit으로 실패했으므로 미종결이다.
`PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md`를 먼저 읽는다.

사용자 확정: 일반 배치는 작업→자체검수→Sol 독립검수→수정/재검수 PASS 후 다음 배치.
Astra 상시 호출은 하지 않고 공용 계약 등 고위험 변경에 필요할 때만 추가한다.
Fable/Opus 공식 검수·전체 verify·네이티브·P3/P4 최종 조건은 면제하지 않는다.
모델 계획 SHA: `983679336be90c350b22e0297c297d89036dddd6489cbf3ea30c53040edcfe37`.

## 준비본 보존

`scripts/three-surface-orders-capture.mjs`는 미검수 WIP로만 보존한다.
`node --check` PASS, 실제 실행·캡처·Sol 검수는 미수행.
작성 시 SHA256: `680c9ea3540ba2e685240a5361ea358db34cf3a908b81a07bddc6059569e4c95`
(체크아웃 줄끝에 따라 바이트 해시는 달라질 수 있으며 커밋 blob이 보존 판본이다).
실제 Expo host + 명시 합성 read fixture, 쓰기 차단. 입력/PNG 측정 증거를 만들 준비본이며
파일 존재나 문법 PASS는 발주 화면 완료 증거가 아니다.
기존 미추적 `.tmp`, `apps/mobile/.tmp`, 식재료 캡처 디렉터리는 삭제/스테이징하지 않았다.

## Docker·개발 서버

재부팅 직전 Docker context는 `desktop-linux`. 이 프로젝트 Supabase 컨테이너 8개를
`docker stop --time 30`으로 정상 중지했다. 실행 중 컨테이너는 0개로 확인했다.
DB 및 Storage 볼륨은 삭제하지 않았으며 다음 볼륨의 존재를 확인했다:
`supabase_db_margincook`, `supabase_storage_margincook`, `supabase_edge_runtime_margincook`.
DB 볼륨은 `/var/lib/postgresql/data`, Storage는 `/mnt`에 마운트돼 있었다.
이는 기존 볼륨 보존이지 별도 dump/외부 백업을 수행했다는 뜻은 아니다.
8091 Expo 세션은 Ctrl-C로 종료했고 해당 listen 포트가 없음을 확인했다.

재부팅 후 Docker Desktop을 켜고 다음 순서로 기존 컨테이너를 재시작한다.
수동 중지했으므로 `unless-stopped` 자동 재시작만 기대하지 않는다.

```powershell
docker start supabase_db_margincook
# docker inspect로 DB healthy 확인 후 나머지 시작
docker start supabase_auth_margincook supabase_rest_margincook supabase_realtime_margincook supabase_storage_margincook supabase_pg_meta_margincook supabase_kong_margincook supabase_studio_margincook
```

기존 볼륨·컨테이너가 없거나 DB unhealthy이면 생성/reset하지 말고 진단한다.
worktree HEAD·tracked diff·모델 계획을 확인하고 Expo를 그 HEAD에서 다시 실행한다:

```powershell
$env:CI='1'
corepack pnpm --filter @margincook/mobile exec expo start --web --port 8091
```

Sol 한도 복구 후 제품 SHA의 읽기 전용 검수부터 재개한다. 그 전에는 승인으로 간주하거나
새 결제/한도 초기화/다른 모델 우회를 하지 않는다. 통과 후 발주 전후 캡처와 공용 기준
레이아웃 작업을 이어간다. 이전 실행 세션 ID·메모리 상태는 재부팅 후 재사용하지 않는다.
