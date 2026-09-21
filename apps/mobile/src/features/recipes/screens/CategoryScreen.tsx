// RCP-12 레시피 카테고리 설정 — 세 종류가 같은 화면을 쓴다(CategoryEditScreen).
import { useLocalSearchParams } from 'expo-router';
import { CategoryEditScreen } from './CategoryEditScreen';

export default function CategoryScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return <CategoryEditScreen kind="recipe" backTo={from === 'my' ? '/my' : '/recipes'} />;
}
