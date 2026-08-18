// 부자재 카테고리 설정 — 세 종류가 같은 화면을 쓴다(CategoryEditScreen).
import { CategoryEditScreen } from './CategoryEditScreen';

export default function MaterialCategoryScreen() {
  return <CategoryEditScreen kind="material" backTo="/my/categories" />;
}
