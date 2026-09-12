import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export const recipeCostSections = ['material', 'extra', 'fixed', 'tax'] as const;
export type RecipeCostSection = typeof recipeCostSections[number];
type Choices = Record<RecipeCostSection, boolean>;
const defaults = (): Choices => ({ material: true, extra: true, fixed: true, tax: true });
const writes = new Map<string, Promise<void>>();
let nativeStorage: Promise<typeof import('expo-secure-store')> | undefined;
const getNativeStorage = () => nativeStorage ??= import('expo-secure-store');

// UI preference only, separate from recipe drafts, financial snapshots and journals.
export function recipeCostDisclosureKey(scope: string, section: RecipeCostSection) {
  return `recipe.cost-disclosure.v1.${Array.from(scope).map(c => c.codePointAt(0)!.toString(16)).join('-')}.${section}`;
}
function initialChoices(scope: string): Choices {
  const result = defaults();
  if (Platform.OS === 'web') for (const section of recipeCostSections) {
    try { result[section] = globalThis.localStorage.getItem(recipeCostDisclosureKey(scope, section)) !== 'false'; }
    catch { /* Storage restrictions must not prevent opening the detail screen. */ }
  }
  return result;
}
function persist(key: string, expanded: boolean) {
  if (Platform.OS === 'web') {
    try { globalThis.localStorage.setItem(key, String(expanded)); } catch { /* Retain the in-session choice. */ }
    return;
  }
  // Serialize rapid taps for each key so the last action remains the saved value.
  const next = (writes.get(key) ?? Promise.resolve())
    .then(async () => (await getNativeStorage()).setItemAsync(key, String(expanded))).catch(() => {});
  writes.set(key, next);
  void next.then(() => { if (writes.get(key) === next) writes.delete(key); });
}

export function useRecipeCostDisclosure(scope: string) {
  const [state, setState] = useState(() => ({ scope, values: initialChoices(scope) }));
  const current = useRef(state);
  if (current.current.scope !== scope) current.current = { scope, values: initialChoices(scope) };
  const touched = useRef(new Map<string, number>());
  useEffect(() => {
    let active = true;
    if (Platform.OS !== 'web') for (const section of recipeCostSections) {
      const key = recipeCostDisclosureKey(scope, section);
      const revision = touched.current.get(key);
      void (async () => {
        await writes.get(key);
        const value = await (await getNativeStorage()).getItemAsync(key);
        if (!active || current.current.scope !== scope || touched.current.get(key) !== revision) return;
        const next = { scope, values: { ...current.current.values, [section]: value !== 'false' } };
        current.current = next; setState(next);
      })().catch(() => {});
    }
    return () => { active = false; };
  }, [scope]);
  return {
    expanded: state.scope === scope ? state.values : current.current.values,
    toggle: (section: RecipeCostSection) => {
      const next = { scope, values: { ...current.current.values, [section]: !current.current.values[section] } };
      const key = recipeCostDisclosureKey(scope, section);
      touched.current.set(key, (touched.current.get(key) ?? 0) + 1); current.current = next; setState(next);
      persist(key, next.values[section]);
    },
  };
}
