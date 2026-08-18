// RCP-12 레시피 카테고리 설정 — 세 종류가 같은 화면을 쓴다(CategoryEditScreen).
import { CategoryEditScreen } from './CategoryEditScreen';

export default function CategoryScreen() {
  return <CategoryEditScreen kind="recipe" backTo="/recipes" />;
}
