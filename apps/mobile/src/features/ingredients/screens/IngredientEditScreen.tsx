// ING-04 식재료 수정 — 추가·수정은 같은 폼이다(IngredientFormScreen).
import { useLocalSearchParams } from 'expo-router';
import { IngredientFormScreen } from './IngredientFormScreen';

export function IngredientEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <IngredientFormScreen id={id} />;
}
