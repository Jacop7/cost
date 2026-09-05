# v0.7 전체 verify 실행과 실패 처분

정확한 기준은 `34cf2b4733cee4da6058f97e529d13a9a0ca81d8` + 기존 dirty 144개 항목의 작업본이다.
앱/패키지/스크립트/설정/채팅 manifest 입력 580개는 실행 전후 SHA가 같았다. 전체 dirty 원문·DB 스냅샷을 보존한 기준선은 아니다.
기계 기록: [TEAM-SERVICE-VERIFY-V07-001.json](TEAM-SERVICE-VERIFY-V07-001.json).

`corepack pnpm verify`를 실제 실행했고 exit 1이다. 러너는 ①/⑤/⑥ ok, ②/③/④ FAIL로 **3/6**을 출력했다.
⑤는 PowerShell이 .sh 파일 연결을 통해 별도 Git Bash 프로세스를 띄워 반환했으므로 실제 완료 증거가 없다.
따라서 ⑤를 통과로 인정하지 않는다. 초기 도구 출력도 일부 잘려 raw 전문을 복구했다고 주장하지 않는다.

| ID | 실패와 처분 | 담당·재검증 |
| --- | --- | --- |
| VERIFY-V07-DB | 개발 DB 43/50. 기대4046.69/실제4046.60 및 쓰기·단가·이력·판본·정정 실패. KNOWN_OPEN_NOT_WAIVED | Data + Quality: DB revision/시험 기대/권위 계산 계약과 fresh 결과 비교. 기존 DB reset·수치 하향 없음 |
| VERIFY-V07-DESIGN | 색 대비 결정 commit 3개가 HEAD 조상이 아님. 뒤의 graph/ACL 검사는 이번 run에서 도달하지 않음 | Knowledge + Quality: 원래 작업에서 결정 계보를 정리. ancestry 검사 삭제 금지 |
| VERIFY-V07-SHELL | 잘못된 SHELL 선택으로 새 DB 준비 경합·0/50, upgrade 조기 성공 표기 | Operations + Quality: 실제 Bash 검증·동기 child 대기·정리 검증·거짓 성공 회귀시험 후 전체 재실행 |

이번 실행이 남긴 고유 upgrade 시험 프로세스와 `fresh_upgrade_check_1950_1042`만 정리했고, 해당 DB와
`fresh_verify_40620_mtocrloe`가 남지 않았음을 확인했다. 개발 DB를 reset하지 않았다. 삭제한 것은 재생 가능한 일회용 시험 DB다.

이 기록은 실패의 처분 후보이며 해결·면제·독립검수 PASS가 아니다. local core 입장은 미통과다.
로컬 경계와의 영향 분리, 정확한 실행 모델, 무발송 AC-24, 독립검수 전에는 제품 구현을 시작하지 않는다.

