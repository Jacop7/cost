// MY-03 식재료 카테고리 설정 — 세 종류가 같은 화면을 쓴다(CategoryEditScreen).
import { CategoryEditScreen } from '@/features/recipes/screens/CategoryEditScreen';

export default function MyCategoryScreen() {
  return <CategoryEditScreen kind="ingredient" backTo="/my/categories" />;
}
