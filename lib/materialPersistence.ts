/**
 * Classifies what a backup can actually preserve for a material reference.
 * A data URL contains the bytes in the record; web URLs only preserve an address.
 */
export type MaterialPersistence = 'embedded' | 'external-link' | 'unstable-reference';

export interface MaterialReferenceSummary {
  embedded: number;
  externalLink: number;
  unstableReference: number;
}

const EMPTY_SUMMARY = (): MaterialReferenceSummary => ({
  embedded: 0,
  externalLink: 0,
  unstableReference: 0,
});

export const classifyMaterialReference = (url: string | null | undefined): MaterialPersistence => {
  const value = url?.trim() ?? '';
  if (/^data:[^,]+,/i.test(value)) return 'embedded';
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.hostname) return 'external-link';
    } catch {
      // Fall through to an unstable reference.
    }
  }
  return 'unstable-reference';
};

export const summarizeMaterialReferences = (
  references: Iterable<string | null | undefined>,
): MaterialReferenceSummary => {
  const result = EMPTY_SUMMARY();
  for (const reference of references) {
    const persistence = classifyMaterialReference(reference);
    if (persistence === 'embedded') result.embedded += 1;
    else if (persistence === 'external-link') result.externalLink += 1;
    else result.unstableReference += 1;
  }
  return result;
};

/** Normalizes the only kind of link material the app deliberately accepts. */
export const normalizeWebMaterialUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return ['https:', 'http:'].includes(parsed.protocol) && parsed.hostname ? parsed.href : null;
  } catch {
    return null;
  }
};
