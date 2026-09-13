import { useLocalSearchParams } from 'expo-router';
import RecipeTaxScreen from '@/features/recipes/screens/RecipeTaxScreen';
import MyTaxScreen from '@/features/my/screens/MyTaxScreen';

/** Reuse MY settings inside the menu stack so Back retains the editing/simulation screen. */
export default function RecipeTaxRoute() {
  const { settings } = useLocalSearchParams<{ settings?: string }>();
  return settings === '1' ? <MyTaxScreen /> : <RecipeTaxScreen />;
}
