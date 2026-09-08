# P3 대상별 진행 근거 — 2026-09-09

기준 제품/기록 HEAD: `ad775d756cba2cf415b2da4f258b0c089f12e488`. 이 표는 페이지 완료 승인이 아니라 증거 수준 집계다.

총 185 = 활성 182 + 숨김 3. 화면 62 + popup@host 123. 최종 종결 0.

- SAMPLE_REVIEWED: 해당 상태의 웹 표본 + 범위 한정 내부검수 근거 있음
- PARTIAL: 시험만·관측만 또는 다른 host 대응 미확정
- UNASSESSED: 해당 target 직접 P3 검수 근거 미확인 (미구현 아님)
- HIDDEN: 프로토타입 숨김 보존

| 영역(중복 제거) | 총수 | 표본 내부검수 | 부분 근거 | 직접 근거 미확인 | 숨김 |
|---|---:|---:|---:|---:|---:|
| ingredients | 44 | 24 | 11 | 6 | 3 |
| my | 39 | 0 | 4 | 35 | 0 |
| orders | 16 | 9 | 7 | 0 | 0 |
| recipes | 47 | 19 | 27 | 1 | 0 |
| sales | 37 | 1 | 4 | 32 | 0 |
| shared | 2 | 0 | 0 | 2 | 0 |

- 모든 상태/데이터·native·공식 외부검수·P3 승계 게이트는 별도이며 finalClosed는 모두 false.
- 현재 source projection 도구는 RCP-07.states 없음으로 FAIL. 이 집계는 registry target 집합과 render-audit target 집합을 직접 양방향 대조한다.
- 공유 2개 fixed_channel target은 shared로 분리해 185 분모를 중복하지 않는다.
- MY-12와 폐기된 RCP-07은 Expo-only로 185에 더하지 않는다.

## 185개 개별 대상

| target | 상태 | 근거/범위 | 남은 작업 |
|---|---|---|---|
| popup:account_delete@my_account | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:add_category@ingredient_add | SAMPLE_REVIEWED | 추가/수정 host 카테고리·단위 선택 변경/재열기/닫기 웹 표본 [ING02/04 공용 선택 시트](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 장목록·영어·IME·native·실제 저장 |
| popup:add_unit@ingredient_add | SAMPLE_REVIEWED | 추가/수정 host 카테고리·단위 선택 변경/재열기/닫기 웹 표본 [ING02/04 공용 선택 시트](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 장목록·영어·IME·native·실제 저장 |
| popup:category_add@my_ingredient_categories | PARTIAL | 3-kind 공용 카테고리 실제 host 시험; 팝업별 웹 시각 근거 없음 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/categoryEditParity.test.tsx) | 추가/수정/삭제 실제 시각·MY 식재료 목록 시각 |
| popup:category_add@my_material_categories | PARTIAL | 동일 공용 Expo 소비처의 근거는 있으나 별도 prototype MY host 대응 미확정 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) | host별 동등성 대조; 공용 PASS를 중복 완료로 전파하지 않음 |
| popup:category_add@my_recipe_categories | PARTIAL | 동일 공용 Expo 소비처의 근거는 있으나 별도 prototype MY host 대응 미확정 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) | host별 동등성 대조; 공용 PASS를 중복 완료로 전파하지 않음 |
| popup:category_add@recipe_category | PARTIAL | 3-kind 공용 카테고리 실제 host 시험; 팝업별 웹 시각 근거 없음 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/categoryEditParity.test.tsx) | 추가/수정/삭제 실제 시각·MY 식재료 목록 시각 |
| popup:category_add@recipe_material_category | PARTIAL | 3-kind 공용 카테고리 실제 host 시험; 팝업별 웹 시각 근거 없음 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/categoryEditParity.test.tsx) | 추가/수정/삭제 실제 시각·MY 식재료 목록 시각 |
| popup:category_delete@my_ingredient_categories | PARTIAL | 3-kind 공용 카테고리 실제 host 시험; 팝업별 웹 시각 근거 없음 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/categoryEditParity.test.tsx) | 추가/수정/삭제 실제 시각·MY 식재료 목록 시각 |
| popup:category_delete@my_material_categories | PARTIAL | 동일 공용 Expo 소비처의 근거는 있으나 별도 prototype MY host 대응 미확정 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) | host별 동등성 대조; 공용 PASS를 중복 완료로 전파하지 않음 |
| popup:category_delete@my_recipe_categories | PARTIAL | 동일 공용 Expo 소비처의 근거는 있으나 별도 prototype MY host 대응 미확정 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) | host별 동등성 대조; 공용 PASS를 중복 완료로 전파하지 않음 |
| popup:category_delete@recipe_category | PARTIAL | 3-kind 공용 카테고리 실제 host 시험; 팝업별 웹 시각 근거 없음 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/categoryEditParity.test.tsx) | 추가/수정/삭제 실제 시각·MY 식재료 목록 시각 |
| popup:category_delete@recipe_material_category | PARTIAL | 3-kind 공용 카테고리 실제 host 시험; 팝업별 웹 시각 근거 없음 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/categoryEditParity.test.tsx) | 추가/수정/삭제 실제 시각·MY 식재료 목록 시각 |
| popup:category_edit@my_ingredient_categories | PARTIAL | 3-kind 공용 카테고리 실제 host 시험; 팝업별 웹 시각 근거 없음 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/categoryEditParity.test.tsx) | 추가/수정/삭제 실제 시각·MY 식재료 목록 시각 |
| popup:category_edit@my_material_categories | PARTIAL | 동일 공용 Expo 소비처의 근거는 있으나 별도 prototype MY host 대응 미확정 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) | host별 동등성 대조; 공용 PASS를 중복 완료로 전파하지 않음 |
| popup:category_edit@my_recipe_categories | PARTIAL | 동일 공용 Expo 소비처의 근거는 있으나 별도 prototype MY host 대응 미확정 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) | host별 동등성 대조; 공용 PASS를 중복 완료로 전파하지 않음 |
| popup:category_edit@recipe_category | PARTIAL | 3-kind 공용 카테고리 실제 host 시험; 팝업별 웹 시각 근거 없음 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/categoryEditParity.test.tsx) | 추가/수정/삭제 실제 시각·MY 식재료 목록 시각 |
| popup:category_edit@recipe_material_category | PARTIAL | 3-kind 공용 카테고리 실제 host 시험; 팝업별 웹 시각 근거 없음 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/categoryEditParity.test.tsx) | 추가/수정/삭제 실제 시각·MY 식재료 목록 시각 |
| popup:channel_disable@my_channels | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:channel_edit@my_channels | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:discard_period@discard | HIDDEN | 숨김 보존; 별도 Expo 화면 검수 여부와 분모 포함은 구분  | 활성 작업 완료율에서 제외, 원본 보존 |
| popup:discard_type@discard | HIDDEN | 숨김 보존; 별도 Expo 화면 검수 여부와 분모 포함은 구분  | 활성 작업 완료율에서 제외, 원본 보존 |
| popup:edit_category@ingredient_edit | SAMPLE_REVIEWED | 추가/수정 host 카테고리·단위 선택 변경/재열기/닫기 웹 표본 [ING02/04 공용 선택 시트](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 장목록·영어·IME·native·실제 저장 |
| popup:edit_unit@ingredient_edit | SAMPLE_REVIEWED | 추가/수정 host 카테고리·단위 선택 변경/재열기/닫기 웹 표본 [ING02/04 공용 선택 시트](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 장목록·영어·IME·native·실제 저장 |
| popup:expense_add@expense | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:expense_delete@expense | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:fixed_channel@fixed_actual | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:fixed_channel@my_fixed_edit | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:fixed_item_add@fixed_actual | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:fixed_item_add@my_fixed_edit | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:fixed_period@fixed_actual | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:fixed_period@fixed_average | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:fixed_period@my_fixed | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:fixed_period@my_fixed_edit | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:hours_break_end@my_hours | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:hours_break_start@my_hours | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:hours_end@my_hours | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:hours_start@my_hours | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:hours_timezone@my_hours | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:ingredient_change_detail@ingredient_changes | SAMPLE_REVIEWED | 식재료 entity 목록·첫 사건 상세 웹 표본 [공유 수정 이력 / 상세·스크롤 후속 / 페이지 연결](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 실제 pagination 스크롤·모든 사건·native |
| popup:ingredient_option_empty@ingredient_detail | SAMPLE_REVIEWED | 메모 입력/취소 복원·빈 구매 옵션·추가 폼의 웹 표본 [ING03 메모 · ING06 빈 목록/추가](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 메모 pending/dirty 이탈·옵션 실저장·native |
| popup:ingredient_option_filled@ingredient_detail | SAMPLE_REVIEWED | 상세 구매 옵션·관리 목록/수정 및 단위 kg/ml/박스 웹 표본 [ING03/06 구매 옵션 행·단가](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 다른 상태·키보드·native·전체 화면 완료 아님 |
| popup:language_preview@my_language | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:material_add@my_materials | PARTIAL | 동일 공용 Expo 소비처의 근거는 있으나 별도 prototype MY host 대응 미확정 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) | host별 동등성 대조; 공용 PASS를 중복 완료로 전파하지 않음 |
| popup:material_add@recipe_materials | SAMPLE_REVIEWED | 실제 recipes 경로의 목록·추가·수정, 카테고리 목록 웹 표본 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/material-manage-final-20260909/recipe-forms-evidence.json) | 카테고리/삭제 팝업 시각·다른 prototype host 동등성·native |
| popup:material_category_pick@my_materials | PARTIAL | 선택/삭제 실제 host 시험만. MY alias host는 대응 미확정 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/materialManageParity.test.tsx) | 실제 팝업 시각·별도 host 동등성 |
| popup:material_category_pick@recipe_materials | PARTIAL | 선택/삭제 실제 host 시험만. MY alias host는 대응 미확정 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/materialManageParity.test.tsx) | 실제 팝업 시각·별도 host 동등성 |
| popup:material_delete@my_materials | PARTIAL | 선택/삭제 실제 host 시험만. MY alias host는 대응 미확정 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/materialManageParity.test.tsx) | 실제 팝업 시각·별도 host 동등성 |
| popup:material_delete@recipe_materials | PARTIAL | 선택/삭제 실제 host 시험만. MY alias host는 대응 미확정 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/materialManageParity.test.tsx) | 실제 팝업 시각·별도 host 동등성 |
| popup:material_edit@my_materials | PARTIAL | 동일 공용 Expo 소비처의 근거는 있으나 별도 prototype MY host 대응 미확정 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) | host별 동등성 대조; 공용 PASS를 중복 완료로 전파하지 않음 |
| popup:material_edit@recipe_materials | SAMPLE_REVIEWED | 실제 recipes 경로의 목록·추가·수정, 카테고리 목록 웹 표본 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/material-manage-final-20260909/recipe-forms-evidence.json) | 카테고리/삭제 팝업 시각·다른 prototype host 동등성·native |
| popup:option_add@options | SAMPLE_REVIEWED | 메모 입력/취소 복원·빈 구매 옵션·추가 폼의 웹 표본 [ING03 메모 · ING06 빈 목록/추가](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 메모 pending/dirty 이탈·옵션 실저장·native |
| popup:option_card_menu@options | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:option_delete@options | PARTIAL | 실제 host 시험·비동기 응답 보호; 해당 옵션 상태 웹 시각 확정 근거 없음 [공용 거래처 실패 / 옵션 편집 비동기 응답](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | ING06 거래처/신규/삭제 시각 검수. ING02/04 거래처 캡처를 전파하지 않음 |
| popup:option_edit@options | SAMPLE_REVIEWED | 상세 구매 옵션·관리 목록/수정 및 단위 kg/ml/박스 웹 표본 [ING03/06 구매 옵션 행·단가](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 다른 상태·키보드·native·전체 화면 완료 아님 |
| popup:option_list@options | SAMPLE_REVIEWED | 상세 구매 옵션·관리 목록/수정 및 단위 kg/ml/박스 웹 표본 [ING03/06 구매 옵션 행·단가](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 다른 상태·키보드·native·전체 화면 완료 아님 |
| popup:option_more@options | SAMPLE_REVIEWED | 기본 화면 및 직접 연 수정 메뉴·폐기·옵션 더보기의 웹 표본 한정 내부검수 [발견·정정·재검수 / 후속 큰 글자 재검수](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) [산출물](../../../docs/prototypes/three-surface-p3-ingredient-visual/candidate-7/render-evidence.json) | 추가 데이터/상태·모든 영역·native·최종 게이트. option_more 관측을 option_card_menu까지 전파하지 않음 |
| popup:option_unit@options | SAMPLE_REVIEWED | 상세 구매 옵션·관리 목록/수정 및 단위 kg/ml/박스 웹 표본 [ING03/06 구매 옵션 행·단가](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 다른 상태·키보드·native·전체 화면 완료 아님 |
| popup:option_vendor_new@options | PARTIAL | 실제 host 시험·비동기 응답 보호; 해당 옵션 상태 웹 시각 확정 근거 없음 [공용 거래처 실패 / 옵션 편집 비동기 응답](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | ING06 거래처/신규/삭제 시각 검수. ING02/04 거래처 캡처를 전파하지 않음 |
| popup:option_vendor@options | PARTIAL | 실제 host 시험·비동기 응답 보호; 해당 옵션 상태 웹 시각 확정 근거 없음 [공용 거래처 실패 / 옵션 편집 비동기 응답](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | ING06 거래처/신규/삭제 시각 검수. ING02/04 거래처 캡처를 전파하지 않음 |
| popup:order_cancel@order_main | PARTIAL | Alert API/웹 bridge 동작 시험만 [ORD-07 취소·급등 Alert 경계](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 실제 dialog 시각·native |
| popup:order_candidates@order_main | SAMPLE_REVIEWED | 보고서 target 표의 목록·두 시트·직접발주·두 선택 팝업 웹/host 및 Sol 한정 PASS [발주 target별 현재 검증 상한](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 목록별 추가 데이터·키보드·native; ORD-06 registry 경로 정정은 별도 |
| popup:order_ingredient@order_direct | SAMPLE_REVIEWED | 보고서 target 표의 목록·두 시트·직접발주·두 선택 팝업 웹/host 및 Sol 한정 PASS [발주 target별 현재 검증 상한](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 목록별 추가 데이터·키보드·native; ORD-06 registry 경로 정정은 별도 |
| popup:order_order@order_detail | PARTIAL | 공용/대체 Expo 경로는 관측했으나 prototype 별도 host 동등성 미확정 [발주 target별 현재 검증 상한](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 화면/host 대응과 registry 정정 |
| popup:order_order@order_main | SAMPLE_REVIEWED | 보고서 target 표의 목록·두 시트·직접발주·두 선택 팝업 웹/host 및 Sol 한정 PASS [발주 target별 현재 검증 상한](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 목록별 추가 데이터·키보드·native; ORD-06 registry 경로 정정은 별도 |
| popup:order_price_spike@order_main | PARTIAL | Alert API/웹 bridge 동작 시험만 [ORD-07 취소·급등 Alert 경계](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 실제 dialog 시각·native |
| popup:order_receive@order_main | SAMPLE_REVIEWED | 보고서 target 표의 목록·두 시트·직접발주·두 선택 팝업 웹/host 및 Sol 한정 PASS [발주 target별 현재 검증 상한](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 목록별 추가 데이터·키보드·native; ORD-06 registry 경로 정정은 별도 |
| popup:order_receive@order_receive | PARTIAL | 공용/대체 Expo 경로는 관측했으나 prototype 별도 host 동등성 미확정 [발주 target별 현재 검증 상한](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 화면/host 대응과 registry 정정 |
| popup:order_received@order_main | SAMPLE_REVIEWED | 보고서 target 표의 목록·두 시트·직접발주·두 선택 팝업 웹/host 및 Sol 한정 PASS [발주 target별 현재 검증 상한](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 목록별 추가 데이터·키보드·native; ORD-06 registry 경로 정정은 별도 |
| popup:order_revert@order_main | PARTIAL | Alert API/웹 bridge 동작 시험만 [ORD-07 취소·급등 Alert 경계](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 실제 dialog 시각·native |
| popup:order_vendor@order_direct | SAMPLE_REVIEWED | 보고서 target 표의 목록·두 시트·직접발주·두 선택 팝업 웹/host 및 Sol 한정 PASS [발주 target별 현재 검증 상한](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 목록별 추가 데이터·키보드·native; ORD-06 registry 경로 정정은 별도 |
| popup:order_waiting@order_main | SAMPLE_REVIEWED | 보고서 target 표의 목록·두 시트·직접발주·두 선택 팝업 웹/host 및 Sol 한정 PASS [발주 target별 현재 검증 상한](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 목록별 추가 데이터·키보드·native; ORD-06 registry 경로 정정은 별도 |
| popup:past_etc@sales_past | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:past_expense@sales_past | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:past_sale_qty@sales_past | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:past_save@sales_past | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:profit_detail@profit | SAMPLE_REVIEWED | 합성 읽기 이력 목록·원인/결과 시트 표본 [손익 변동 공용화](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/profit-history-after-20260909/recipe-forms-evidence.json) | 실DB·전체 목록 끝·native |
| popup:purchase_period@purchase | SAMPLE_REVIEWED | 재고/구매 이력 및 구매 기간 선택 웹 표본·실제 host 시험 [ING07/08/09/10 필터 · 공용 요약 / 긴 행·음수 잔량 / 공용 metrics](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 2줄 초과 메모·숫자/단위 줄 분리·추가 값·native |
| popup:recipe_category_pick@recipe_add | PARTIAL | 실제 폼 카테고리·사용량 연결 시험. 양 host별 시각 PASS는 아님 [추가/수정 폼](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/recipeFormParity.test.tsx) | 추가·수정별 팝업 실렌더 |
| popup:recipe_category_pick@recipe_edit | PARTIAL | 실제 폼 카테고리·사용량 연결 시험. 양 host별 시각 PASS는 아님 [추가/수정 폼](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/recipeFormParity.test.tsx) | 추가·수정별 팝업 실렌더 |
| popup:recipe_change_detail@recipe_changes | SAMPLE_REVIEWED | 메뉴 entity의 공용 이력 목록·첫 사건 상세 웹 표본과 내부 검수 [공유 수정 이력 / 상세·스크롤 후속 / 페이지 연결](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 실제 pagination 스크롤·모든 사건·native |
| popup:recipe_ingredient_usage@recipe_edit | PARTIAL | 실제 폼 카테고리·사용량 연결 시험. 양 host별 시각 PASS는 아님 [추가/수정 폼](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/recipeFormParity.test.tsx) | 추가·수정별 팝업 실렌더 |
| popup:recipe_ingredient_usage@recipe_ingredient_search | PARTIAL | 재료 사용량 host 시험; 부자재는 실제 즉시 담기 흐름으로 prototype 시트와 다름 [식재료·부자재 검색](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/recipeSearchParity.test.tsx) | 시트 실렌더 및 부자재 usage target 대응 확정 |
| popup:recipe_material_usage@recipe_material_search | PARTIAL | 재료 사용량 host 시험; 부자재는 실제 즉시 담기 흐름으로 prototype 시트와 다름 [식재료·부자재 검색](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/recipeSearchParity.test.tsx) | 시트 실렌더 및 부자재 usage target 대응 확정 |
| popup:recipe_memo@recipe_detail | PARTIAL | RecipeDetail 실제 host 시험4건, 공용 메모 표본은 식재료 host [공용 메모 재조회 보호](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) [산출물](../../../apps/mobile/tests/recipeDetailMemo.test.tsx) | 메뉴 host 메모 실렌더·pending/IME |
| popup:recipe_sort@recipe_main | SAMPLE_REVIEWED | 목록·검색·정렬·판매상태·목표 필터 웹 표본과 내부 검수 [RCP-01](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/list-common-filters-20260909/recipes-list-evidence.json) | FAB/안내 겹침·추가 데이터·native·최종 게이트 |
| popup:recipe_status@recipe_main | SAMPLE_REVIEWED | 목록·검색·정렬·판매상태·목표 필터 웹 표본과 내부 검수 [RCP-01](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/list-common-filters-20260909/recipes-list-evidence.json) | FAB/안내 겹침·추가 데이터·native·최종 게이트 |
| popup:recipe_stop@recipe_detail | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:recipe_target@recipe_main | SAMPLE_REVIEWED | 목록·검색·정렬·판매상태·목표 필터 웹 표본과 내부 검수 [RCP-01](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/list-common-filters-20260909/recipes-list-evidence.json) | FAB/안내 겹침·추가 데이터·native·최종 게이트 |
| popup:sales_break@sales_main | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:sales_close@sales_main | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:sales_direct_period@analytics | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:sales_etc@sales_main | PARTIAL | 비변경 대조/후속 파악용 캡처와 일부 host 시험 [보존된 웹 before/after / 확인된 다음 배치](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-SALES-REVIEW-20260909.md) | 시트 sub/입력/합계·기타매출 및 지출 결과/1:1 행동 개선 미완료 |
| popup:sales_expense@sales_main | PARTIAL | 비변경 대조/후속 파악용 캡처와 일부 host 시험 [보존된 웹 before/after / 확인된 다음 배치](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-SALES-REVIEW-20260909.md) | 시트 sub/입력/합계·기타매출 및 지출 결과/1:1 행동 개선 미완료 |
| popup:sales_extra_detail@extra | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:sales_fixed_expand@sales_fixed | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:sales_material_detail@material | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:sales_menu_profit@day | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:sales_period@analytics | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:sales_qty@sales_main | PARTIAL | 비변경 대조/후속 파악용 캡처와 일부 host 시험 [보존된 웹 before/after / 확인된 다음 배치](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-SALES-REVIEW-20260909.md) | 시트 sub/입력/합계·기타매출 및 지출 결과/1:1 행동 개선 미완료 |
| popup:sales_revenue_all@revenue | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:sales_shortage@sales_main | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:sales_sort@sales_main | PARTIAL | 비변경 대조/후속 파악용 캡처와 일부 host 시험 [보존된 웹 before/after / 확인된 다음 배치](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-SALES-REVIEW-20260909.md) | 시트 sub/입력/합계·기타매출 및 지출 결과/1:1 행동 개선 미완료 |
| popup:sales_state@sales_main | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:sort@ingredient_main | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:stock_check_all@stock_check | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:stock_confirm@stock_change | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:stock_deduct@stock_change | PARTIAL | ING05 실사/완전소진 관측은 있으나 prototype 기본 입고·차감 의미와 1:1 미확정 [발견·정정·재검수 / 후속 큰 글자 재검수](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | prototype 상태와 실제 실사/차감 역할 대조 |
| popup:stock_discard@stock_change | SAMPLE_REVIEWED | 기본 화면 및 직접 연 수정 메뉴·폐기·옵션 더보기의 웹 표본 한정 내부검수 [발견·정정·재검수 / 후속 큰 글자 재검수](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) [산출물](../../../docs/prototypes/three-surface-p3-ingredient-visual/candidate-7/render-evidence.json) | 추가 데이터/상태·모든 영역·native·최종 게이트. option_more 관측을 option_card_menu까지 전파하지 않음 |
| popup:stock_error@stock_change | PARTIAL | 별도 QuickInbound host의 입고·옵션·오류 관련 근거; prototype stock_change host 동등성 미확정 [ING03b 빠른 입고 / 간편 입고 재조회 / 빠른 입고 스크롤 끝 확인](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | host 대응 및 해당 오류 상태 실렌더; QuickInbound PASS를 StockEdit로 전파하지 않음 |
| popup:stock_event_more@stock | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:stock_event_revert@stock | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:stock_inbound@stock_change | PARTIAL | 별도 QuickInbound host의 입고·옵션·오류 관련 근거; prototype stock_change host 동등성 미확정 [ING03b 빠른 입고 / 간편 입고 재조회 / 빠른 입고 스크롤 끝 확인](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | host 대응 및 해당 오류 상태 실렌더; QuickInbound PASS를 StockEdit로 전파하지 않음 |
| popup:stock_option@stock_change | PARTIAL | 별도 QuickInbound host의 입고·옵션·오류 관련 근거; prototype stock_change host 동등성 미확정 [ING03b 빠른 입고 / 간편 입고 재조회 / 빠른 입고 스크롤 끝 확인](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | host 대응 및 해당 오류 상태 실렌더; QuickInbound PASS를 StockEdit로 전파하지 않음 |
| popup:stock_order@stock | PARTIAL | Expo ING08 통합 조회 시트의 필터 시험·웹 관측 [ING07/08/09/10 필터 · 공용 요약](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | prototype 개별 popup 3개와 통합 시트의 대응 계약 확정 |
| popup:stock_period@stock | PARTIAL | Expo ING08 통합 조회 시트의 필터 시험·웹 관측 [ING07/08/09/10 필터 · 공용 요약](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | prototype 개별 popup 3개와 통합 시트의 대응 계약 확정 |
| popup:stock_type@stock | PARTIAL | Expo ING08 통합 조회 시트의 필터 시험·웹 관측 [ING07/08/09/10 필터 · 공용 요약](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | prototype 개별 popup 3개와 통합 시트의 대응 계약 확정 |
| popup:tax_country@my_tax | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:tax_item_add@my_tax | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:tax_saved@my_tax | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:vendor_add@my_vendors | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:vendor_delete@my_vendors | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| popup:vendor_edit@my_vendors | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:analytics | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:channel | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:day | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:day_full | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:discard | HIDDEN | 숨김 보존; 별도 Expo 화면 검수 여부와 분모 포함은 구분  | 활성 작업 완료율에서 제외, 원본 보존 |
| screen:expense | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:extra | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:fixed_actual | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:fixed_average | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:ingredient_add | SAMPLE_REVIEWED | 기본 화면 및 직접 연 수정 메뉴·폐기·옵션 더보기의 웹 표본 한정 내부검수 [발견·정정·재검수 / 후속 큰 글자 재검수](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) [산출물](../../../docs/prototypes/three-surface-p3-ingredient-visual/candidate-7/render-evidence.json) | 추가 데이터/상태·모든 영역·native·최종 게이트. option_more 관측을 option_card_menu까지 전파하지 않음 |
| screen:ingredient_changes | SAMPLE_REVIEWED | 식재료 entity 목록·첫 사건 상세 웹 표본 [공유 수정 이력 / 상세·스크롤 후속 / 페이지 연결](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 실제 pagination 스크롤·모든 사건·native |
| screen:ingredient_delete | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:ingredient_detail | SAMPLE_REVIEWED | 기본 화면 및 직접 연 수정 메뉴·폐기·옵션 더보기의 웹 표본 한정 내부검수 [발견·정정·재검수 / 후속 큰 글자 재검수](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) [산출물](../../../docs/prototypes/three-surface-p3-ingredient-visual/candidate-7/render-evidence.json) | 추가 데이터/상태·모든 영역·native·최종 게이트. option_more 관측을 option_card_menu까지 전파하지 않음 |
| screen:ingredient_edit | SAMPLE_REVIEWED | 기본 화면 및 직접 연 수정 메뉴·폐기·옵션 더보기의 웹 표본 한정 내부검수 [발견·정정·재검수 / 후속 큰 글자 재검수](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) [산출물](../../../docs/prototypes/three-surface-p3-ingredient-visual/candidate-7/render-evidence.json) | 추가 데이터/상태·모든 영역·native·최종 게이트. option_more 관측을 option_card_menu까지 전파하지 않음 |
| screen:ingredient_edit_menu | SAMPLE_REVIEWED | 기본 화면 및 직접 연 수정 메뉴·폐기·옵션 더보기의 웹 표본 한정 내부검수 [발견·정정·재검수 / 후속 큰 글자 재검수](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) [산출물](../../../docs/prototypes/three-surface-p3-ingredient-visual/candidate-7/render-evidence.json) | 추가 데이터/상태·모든 영역·native·최종 게이트. option_more 관측을 option_card_menu까지 전파하지 않음 |
| screen:ingredient_main | SAMPLE_REVIEWED | 기본 화면 및 직접 연 수정 메뉴·폐기·옵션 더보기의 웹 표본 한정 내부검수 [발견·정정·재검수 / 후속 큰 글자 재검수](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) [산출물](../../../docs/prototypes/three-surface-p3-ingredient-visual/candidate-7/render-evidence.json) | 추가 데이터/상태·모든 영역·native·최종 게이트. option_more 관측을 option_card_menu까지 전파하지 않음 |
| screen:material | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:memo_edit | SAMPLE_REVIEWED | 메모 입력/취소 복원·빈 구매 옵션·추가 폼의 웹 표본 [ING03 메모 · ING06 빈 목록/추가](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 메모 pending/dirty 이탈·옵션 실저장·native |
| screen:menu | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:my_account | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:my_channels | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:my_fixed | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:my_fixed_edit | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:my_hours | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:my_ingredient_categories | PARTIAL | 3-kind 공용 카테고리 실제 host 시험; 팝업별 웹 시각 근거 없음 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../apps/mobile/tests/categoryEditParity.test.tsx) | 추가/수정/삭제 실제 시각·MY 식재료 목록 시각 |
| screen:my_language | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:my_main | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:my_material_categories | PARTIAL | 동일 공용 Expo 소비처의 근거는 있으나 별도 prototype MY host 대응 미확정 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) | host별 동등성 대조; 공용 PASS를 중복 완료로 전파하지 않음 |
| screen:my_materials | PARTIAL | 동일 공용 Expo 소비처의 근거는 있으나 별도 prototype MY host 대응 미확정 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) | host별 동등성 대조; 공용 PASS를 중복 완료로 전파하지 않음 |
| screen:my_notifications | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:my_recipe_categories | PARTIAL | 동일 공용 Expo 소비처의 근거는 있으나 별도 prototype MY host 대응 미확정 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) | host별 동등성 대조; 공용 PASS를 중복 완료로 전파하지 않음 |
| screen:my_settings | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:my_tax | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:my_units | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:my_vendors | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:options | SAMPLE_REVIEWED | 기본 화면 및 직접 연 수정 메뉴·폐기·옵션 더보기의 웹 표본 한정 내부검수 [발견·정정·재검수 / 후속 큰 글자 재검수](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) [산출물](../../../docs/prototypes/three-surface-p3-ingredient-visual/candidate-7/render-evidence.json) | 추가 데이터/상태·모든 영역·native·최종 게이트. option_more 관측을 option_card_menu까지 전파하지 않음 |
| screen:order_detail | PARTIAL | 공용/대체 Expo 경로는 관측했으나 prototype 별도 host 동등성 미확정 [발주 target별 현재 검증 상한](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 화면/host 대응과 registry 정정 |
| screen:order_direct | SAMPLE_REVIEWED | 보고서 target 표의 목록·두 시트·직접발주·두 선택 팝업 웹/host 및 Sol 한정 PASS [발주 target별 현재 검증 상한](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 목록별 추가 데이터·키보드·native; ORD-06 registry 경로 정정은 별도 |
| screen:order_main | SAMPLE_REVIEWED | 보고서 target 표의 목록·두 시트·직접발주·두 선택 팝업 웹/host 및 Sol 한정 PASS [발주 target별 현재 검증 상한](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 목록별 추가 데이터·키보드·native; ORD-06 registry 경로 정정은 별도 |
| screen:order_receive | PARTIAL | 공용/대체 Expo 경로는 관측했으나 prototype 별도 host 동등성 미확정 [발주 target별 현재 검증 상한](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-ORDERS-REVIEW-20260909.md) | 화면/host 대응과 registry 정정 |
| screen:profit | SAMPLE_REVIEWED | 합성 읽기 이력 목록·원인/결과 시트 표본 [손익 변동 공용화](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/profit-history-after-20260909/recipe-forms-evidence.json) | 실DB·전체 목록 끝·native |
| screen:purchase | SAMPLE_REVIEWED | 재고/구매 이력 및 구매 기간 선택 웹 표본·실제 host 시험 [ING07/08/09/10 필터 · 공용 요약 / 긴 행·음수 잔량 / 공용 metrics](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 2줄 초과 메모·숫자/단위 줄 분리·추가 값·native |
| screen:recipe_add | SAMPLE_REVIEWED | 폼·상세·시뮬레이션의 명시된 변경 및 시각 표본 한정 내부 PASS [사용자 정정: 월평균 / 판매가 시뮬레이션](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/monthly-retirement-after-20260909/recipe-forms-evidence.json) | 상세 도넛 잔여, app_capabilities404/보고 쓰기 차단으로 전체 캡처 exit1; 전체 화면 PASS 아님 |
| screen:recipe_category | SAMPLE_REVIEWED | 실제 recipes 경로의 목록·추가·수정, 카테고리 목록 웹 표본 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/material-manage-final-20260909/recipe-forms-evidence.json) | 카테고리/삭제 팝업 시각·다른 prototype host 동등성·native |
| screen:recipe_changes | SAMPLE_REVIEWED | 메뉴 entity의 공용 이력 목록·첫 사건 상세 웹 표본과 내부 검수 [공유 수정 이력 / 상세·스크롤 후속 / 페이지 연결](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 실제 pagination 스크롤·모든 사건·native |
| screen:recipe_detail | SAMPLE_REVIEWED | 폼·상세·시뮬레이션의 명시된 변경 및 시각 표본 한정 내부 PASS [사용자 정정: 월평균 / 판매가 시뮬레이션](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/monthly-retirement-after-20260909/recipe-forms-evidence.json) | 상세 도넛 잔여, app_capabilities404/보고 쓰기 차단으로 전체 캡처 exit1; 전체 화면 PASS 아님 |
| screen:recipe_edit | SAMPLE_REVIEWED | 폼·상세·시뮬레이션의 명시된 변경 및 시각 표본 한정 내부 PASS [사용자 정정: 월평균 / 판매가 시뮬레이션](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/monthly-retirement-after-20260909/recipe-forms-evidence.json) | 상세 도넛 잔여, app_capabilities404/보고 쓰기 차단으로 전체 캡처 exit1; 전체 화면 PASS 아님 |
| screen:recipe_ingredient_search | SAMPLE_REVIEWED | 검색 목록 이름/배지 배치 및 실제 host 시험 [식재료·부자재 검색](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/search-breakdown-after-20260909/recipe-forms-evidence.json) | 사용량 팝업 별도, 장목록·native |
| screen:recipe_main | SAMPLE_REVIEWED | 목록·검색·정렬·판매상태·목표 필터 웹 표본과 내부 검수 [RCP-01](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/list-common-filters-20260909/recipes-list-evidence.json) | FAB/안내 겹침·추가 데이터·native·최종 게이트 |
| screen:recipe_material_category | SAMPLE_REVIEWED | 실제 recipes 경로의 목록·추가·수정, 카테고리 목록 웹 표본 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/material-manage-final-20260909/recipe-forms-evidence.json) | 카테고리/삭제 팝업 시각·다른 prototype host 동등성·native |
| screen:recipe_material_search | SAMPLE_REVIEWED | 검색 목록 이름/배지 배치 및 실제 host 시험 [식재료·부자재 검색](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/search-breakdown-after-20260909/recipe-forms-evidence.json) | 사용량 팝업 별도, 장목록·native |
| screen:recipe_materials | SAMPLE_REVIEWED | 실제 recipes 경로의 목록·추가·수정, 카테고리 목록 웹 표본 [부자재 관리·카테고리 공용 소비](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/material-manage-final-20260909/recipe-forms-evidence.json) | 카테고리/삭제 팝업 시각·다른 prototype host 동등성·native |
| screen:recipe_price_sim | SAMPLE_REVIEWED | 폼·상세·시뮬레이션의 명시된 변경 및 시각 표본 한정 내부 PASS [사용자 정정: 월평균 / 판매가 시뮬레이션](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-RECIPES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-recipes-visual/monthly-retirement-after-20260909/recipe-forms-evidence.json) | 상세 도넛 잔여, app_capabilities404/보고 쓰기 차단으로 전체 캡처 exit1; 전체 화면 PASS 아님 |
| screen:revenue | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:sales_fixed | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:sales_main | SAMPLE_REVIEWED | 메뉴 목록 배치 변경 웹 표본 및 Sol 한정 PASS [SALES-01 메뉴 목록](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-SALES-REVIEW-20260909.md) [산출물](../../../docs/prototypes/three-surface-p3-sales-visual/after-menu-20260909/sales-evidence.json) | 같은 화면 영업바 날짜 잘림·다른 상태·팝업 잔여. 전체 홈 완료 아님 |
| screen:sales_past | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:stock | SAMPLE_REVIEWED | 재고/구매 이력 및 구매 기간 선택 웹 표본·실제 host 시험 [ING07/08/09/10 필터 · 공용 요약 / 긴 행·음수 잔량 / 공용 metrics](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | 2줄 초과 메모·숫자/단위 줄 분리·추가 값·native |
| screen:stock_change | PARTIAL | ING05 실사/완전소진 관측은 있으나 prototype 기본 입고·차감 의미와 1:1 미확정 [발견·정정·재검수 / 후속 큰 글자 재검수](../../../docs/ai-review/evidence/PROTOTYPE-EXPO-P3-INGREDIENTS-ASTRA-20260908.md) | prototype 상태와 실제 실사/차감 역할 대조 |
| screen:stock_check | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:tax | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
| screen:waste | UNASSESSED | 이번 P3 보고서에서 해당 target 상태의 직접 검수 근거를 확인하지 못함  | 실제 대응 경로·디자인 차이·상태별 시험·시각 검수 필요; 구현 부재를 뜻하지 않음 |
