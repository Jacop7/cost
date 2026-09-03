# 일반 Task HANDOFF 경계

이 경로는 새 HANDOFF schema나 채팅 원문을 소유하지 않는다. 일반 Task의 봉인 snapshot은
[온톨로지 §3](../../AI-지식-온톨로지-기획안.md)과
[팀 구성안 §5](../../팀구성_상세기획안.md)의 계약을 그대로 사용하고,
[작업큐](../../작업큐.md)는 최신 `handoff_id`·version·원본 경로·content hash pointer만 가진다.

실제 원본은 `docs/team/handoffs/<TASK-ID>/<HANDOFF-ID>.md`에 append-only로 추가한다. 첫 원본은
11단계 파일럿 Task에서 만들며, 그 전에는 예시·빈 원본·대화 요약을 생성하지 않는다. 한 HANDOFF는
하나의 successor만 가리키고 동일·낮은 version 또는 같은 predecessor의 분기는 거부한다.
