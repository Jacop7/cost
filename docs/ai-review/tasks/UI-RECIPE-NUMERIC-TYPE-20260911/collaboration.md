# UI-RECIPE-NUMERIC-TYPE-20260911 공동 작업 장부


## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR`
- reply_to_turn_id: `null`
- changed_artifact_paths: `apps/mobile/src/features/recipes/screens/RecipesListScreen.tsx`
- Request: Review the four typography lines. Amounts use 16px/800 and percentages 14px/700, matching IngCard. Preserve colors, server values, sorting, states and navigation.
- Evidence: Typecheck passed; recipesListParity 17/17 passed; actual Expo recipe_main visually inspected. Full verification running. No native/P3 completion claim.
- next_review_request: `FABLE_REVIEW`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- decision: User explicitly waived Fable review for this UI change for now: 페이블 검수 안해도돼 일단.
- scope: UI-RECIPE-NUMERIC-TYPE-20260911 only. No further external review call for this change. This does not waive review for future work or assert native/P3/merge/deployment completion.
