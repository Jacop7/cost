import { Badge } from '@/components/kit';
import { classifyChange, classifyEntityHistoryChange, type ChangeClassification, type EntityChangeType } from '../changeClassification';

/** Explicit operation and cause classify an event independently of field diffs or financial effects. */
export function ChangeSourceBadge({ change, entity }: { change: ChangeClassification; entity?: EntityChangeType }) {
  const classification = entity ? classifyEntityHistoryChange(change, entity) : classifyChange(change);
  if (!classification) return null;
  return <Badge sm alignSelf="center" tone={classification.automatic ? 'blue' : 'neutral'}>{classification.label}</Badge>;
}
