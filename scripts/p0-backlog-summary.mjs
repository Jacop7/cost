/** Aggregate open findings without treating the same finding in two ledgers as a new defect. */
export function summarizeOpenBacklogs(p0Messages, successorMessages) {
  for (const messages of [p0Messages, successorMessages]) {
    if (!Array.isArray(messages) || messages.some((message) => typeof message !== 'string' || !message.trim())) {
      throw new TypeError('backlog messages must be non-empty strings');
    }
  }
  const p0 = new Set(p0Messages), successor = new Set(successorMessages);
  return {
    p0Regression: p0Messages.length,
    overlap: [...successor].filter((message) => p0.has(message)).length,
    combinedUniqueOpen: new Set([...p0, ...successor]).size,
  };
}
