import { Redirect } from 'expo-router';

/** 옛 MY 재료 카테고리 주소는 재료 설정의 카테고리 편집으로 보낸다. */
export default function RetiredMyIngredientCategoryRoute() {
  return <Redirect href="/recipes/manage-order?kind=ingredient&target=category" />;
}
