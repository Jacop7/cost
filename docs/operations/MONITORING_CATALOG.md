# 관측 카탈로그 진입점

실제 지표·로그·경보의 현재 설정을 복사하지 않고 소유 위치와 점검 목적만 연결한다.

| 표면 | 확인 목적 | 연결 권위 |
|---|---|---|
| 앱·API 오류 | 사용자 영향·회귀 탐지 | [작업큐](../작업큐.md)와 해당 Task 증거 |
| DB·RPC·경합 | 원장·트랜잭션·성능 이상 | [ARCHITECTURE](../../ARCHITECTURE.md) |
| Auth·RLS·ACL | 권한 확대·접근 실패 | [AGENTS](../../AGENTS.md)와 보안 감사 원본 |
| Cron·Edge·Webhook | 누락·중복·지연 | [Server Operations 팀](../team/teams/03-server-supabase-operations.md) |
| 용량·비용·백업 | 임계 접근·복구 가능성 | [서버 확장 아키텍처](../서버-확장-아키텍처-기획안.md) |

임계값 변경·비용 지출·운영 중단은 사람 Decision을 요구한다.
