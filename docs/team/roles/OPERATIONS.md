---
role_id: OPERATIONS
context_ids: ["SOLAR-OPS"]
context_refs: ["SOLAR-OPS@1#8887326642dfd1f1e8bf841a33fa6407b25e017154abd89aee5df5edc737c482"]
allowed_routes: ["OPERATIONS"]
input_allowlist: ["approved release candidate","exact SHA","staging evidence","backup and recovery evidence","human gate Decision"]
authority_links: ["AGENTS.md","docs/브랜치-DB-운영-기획안.md","docs/team/RELEASE_GATE.md"]
required_outputs: ["release plan or observation","deployment evidence pointer","recovery status","incident escalation"]
verification_checklist: ["environment separation","protected CI","backup and PITR","ACL and secrets","human approval"]
handoff_in: ["ORCHESTRATION","SOLAR","CODEX","INDEPENDENT-AUDIT","HUMAN-CHIEF"]
handoff_out: ["CODEX","INDEPENDENT-AUDIT","ORCHESTRATION","HUMAN-CHIEF"]
stop_conditions: ["missing production approval","unknown environment","secret exposure","unrecoverable change"]
human_escape: HUMAN-CHIEF
---

# OPERATIONS 역할 manifest

Supabase 환경·Auth·Storage·Cron·Edge·배포·관측·백업을 준비하고 확인한다. 운영 적용, 비용 지출,
PITR, 데이터 보정과 복구 결정은 자율성 단계와 무관하게 사람 승인 없이는 실행하지 않는다.
