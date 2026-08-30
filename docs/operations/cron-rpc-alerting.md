# Cron·RPC 운영 경보 런북

## 범위

- `margincook-close-due`, `margincook-apply-breaks`: 마지막 성공이 5분보다 오래되거나 최신 실패가
  회복되지 않으면 장애다.
- `margincook-purge-changes`: 마지막 성공이 30시간보다 오래되면 장애다. 최초 배포 뒤 실행 이력이
  없을 때도 `ops.monitoring_config.started_at`부터 30시간만 유예한다.
- RPC: 최근 15분 동안 앱이 보고한 예상 밖 오류 **건수**다. 전체 호출 수가 없어 오류율이 아니다.
  인증 앱이 만드는 비권위 신호이므로 별도 `warning`으로만 다루고 Cron의 `status`나 workflow
  성공·실패를 바꾸지 않는다.

## 비밀과 외부 호출

1. 대상 Supabase Project Secret에 임의의 긴 `OPS_HEALTH_TOKEN`을 저장한다.
2. `ops-health`를 `verify_jwt=false` 설정과 함께 배포한다. 함수는
   `x-ops-health-token`을 상수 시간 비교하므로 이 헤더가 없거나 틀리면 `401`이다.
3. GitHub Actions secret `STAGING_OPS_HEALTH_URL`에는
   `https://<project-ref>.supabase.co/functions/v1/ops-health`를 저장한다.
4. `STAGING_OPS_HEALTH_TOKEN`에는 1번과 같은 값을 저장한다. service role·DB 비밀번호를 GitHub에
   넣지 않는다.

## 정상·장애·회복 시험

1. 올바른 토큰 호출이 HTTP `200`, `status=ok`, `cron.monitored=true`, Cron 세 작업
   `healthy=true`인지 확인한다. RPC 보고가 있으면 `rpc.warning=true`여도 HTTP는 `200`이다.
2. 토큰 없이 호출해 `401`인지 확인한다.
3. 스테이징에서 `margincook-close-due` 한 작업만 잠시 `active=false`로 바꾼다.
4. workflow를 수동 실행해 HTTP `503`과 `[ops-health] staging cron degraded` 이슈 생성을 확인한다.
5. 즉시 같은 작업을 `active=true`로 되돌리고 1분 성공 이력을 기다린다.
6. workflow를 다시 실행해 `200`과 이슈 자동 종료를 확인한다.
7. 작업의 최종 `active=true`, 마지막 `succeeded`, 실행 시각과 workflow run·issue URL을 배포 증거에
   남긴다. 실패 상태를 남긴 채 종료하지 않는다.

## 대응

- 두 1분 Cron이 함께 stale이면 pg_cron scheduler와 DB 상태부터 확인한다.
- 한 작업만 실패하면 `cron.job_run_details.return_message`와 해당 함수의 최근 변경을 확인한다.
- `[ops-health] staging rpc warning`은 Cron 장애가 아니라 client-reported 참고 신호다. workflow를
  실패시키지 않으며, fingerprint의 code·detail·플랫폼만 보고 동일 배포 SHA에서 재현한다. 원문 오류나
  사용자 입력을 이 원장에 추가하지 않는다. 단일 사용자 보고만으로 서비스 장애를 선언하지 않는다.
- GitHub 외부 호출 자체가 실패하면 Supabase status, Edge Function 배포 상태, Project Secret과
  workflow secret을 순서대로 확인한다.
