import type { ReactNode } from 'react';
import { UnitPriceDigitsContext } from '@/lib/unitPriceFormat';
import { useStoreSettings } from './hooks';

export function UnitPriceFormatProvider({ children }: { children: ReactNode }) {
  const settings = useStoreSettings();
  return <UnitPriceDigitsContext.Provider value={settings.data?.unitPriceDigits}>{children}</UnitPriceDigitsContext.Provider>;
}
