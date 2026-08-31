
## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-f001`
- target_commit_sha: `9467c97c14fc757948bf715d6a1b73bb8c80d82c`
- verified_input_files_sha256: `dc92af5d0de50627532f239cad477b222193ea2f23ae676efb4df149656e9f8f`
- finding_ids: `INTL-BASE-F001-UNMATERIALIZED-LINK-TARGETS`
- 실행 명령: 권위 작업 루트에서 `corepack pnpm verify`; target commit 다섯 공식 문서 상대 링크 검사와 `git diff --check`; GitHub Actions REST API로 exact SHA run `33356799254`의 전체 job 결과 대조.
- 종료 코드·결과: 로컬 verify 6/6 exit 0(DB 36/36, core 178·2 skipped, mobile 212, ACL·배포 계약, 새 DB·경합·locale parity, upgrade 13/13, 웹 번들). 원격 run `33356799254`의 Node 20.19.4·Node 24·full-db-required·protected-gate가 모두 completed/success.
- Fable 판정: r001 PASS, 필수 미해결 0건. review/run SHA-256은 `be388f095a41c82104f9cdd7e178655352d991597c445eea667ba5a97efa2deb` / `11172d72cb993aeb171397eb3b5c1e34779a8edd8ea480c3e8945d8bd11c12d4`다.
- target 결속: COMMIT manifest가 target tree `6c4b8a600d787cafdb5fff2544534ff35960f225`의 다섯 문서와 reference/evidence bytes를 봉인했다. 사용자 WIP는 target commit·Fable 입력·스테이징에서 제외했다.
- 미실행 항목과 이유: production 배포와 국제 출시 DB 구현은 기준선 외부 게이트 종결 뒤 별도 작업이다.
- next_review_request: `AI_DEPUTY_GATE_REVIEW`
