import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { useFixedCosts } from '@/features/my/hooks';
import { useAppCapabilities, useInternationalTaxState } from '@/features/international-tax';
import { useStoreSettings } from '@/features/settings/hooks';

export type ConfigurationPresence = 'unknown' | 'empty' | 'configured';

/** Configuration presence is independent of a menu's price, quantity and quote total. */
export function useRecipeCostSettings() {
  const date = useStoreLocalDate();
  const month = !date.error ? date.date?.slice(0, 7) ?? '' : '';
  const fixed = useFixedCosts(month, Boolean(month));
  const capabilities = useAppCapabilities();
  const tax = useInternationalTaxState();
  const legacy = useStoreSettings();
  const fixedPresence: ConfigurationPresence = !month || fixed.isFetching || fixed.error || !fixed.data
    ? 'unknown' : fixed.data.items.length ? 'configured' : 'empty';
  let taxPresence: ConfigurationPresence = 'unknown';
  if (!capabilities.error && !capabilities.isLoading && capabilities.data) {
    if (capabilities.data.internationalTax.readEnabled) {
      if (!tax.isFetching && !tax.error && tax.data) taxPresence = tax.data.taxProfile ? 'configured' : 'empty';
    } else if (!legacy.isFetching && !legacy.error && legacy.data) {
      taxPresence = legacy.data.taxItems.length ? 'configured' : 'empty';
    }
  }
  return { month, fixedPresence, taxPresence,
    fixedData: fixedPresence !== 'unknown' ? fixed.data : undefined,
    retry: () => { date.refetch(); if (month) void fixed.refetch(); void capabilities.refetch(); void tax.refetch(); void legacy.refetch(); },
  };
}
