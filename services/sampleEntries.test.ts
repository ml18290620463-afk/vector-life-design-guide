import { describe, expect, it } from 'vitest';
import { getSampleEntries, isSampleId } from './sampleEntries';

describe('services/sampleEntries', () => {
  it('returns exactly two seeded reflections per supported language', () => {
    expect(getSampleEntries('zh')).toHaveLength(2);
    expect(getSampleEntries('en')).toHaveLength(2);
  });

  it('every sample entry carries isSample=true', () => {
    for (const lang of ['zh', 'en'] as const) {
      for (const entry of getSampleEntries(lang)) {
        expect(entry.isSample).toBe(true);
      }
    }
  });

  it('every sample entry id starts with sample- prefix', () => {
    for (const lang of ['zh', 'en'] as const) {
      for (const entry of getSampleEntries(lang)) {
        expect(entry.id.startsWith('sample-')).toBe(true);
        expect(isSampleId(entry.id)).toBe(true);
      }
    }
  });

  it('first sample is the family memory, second is the daily reflection', () => {
    // The Dashboard shows newest first; getSampleEntries returns
    // [family, daily] so the most recent sample sits on top. This pin
    // protects the ordering contract relied on by `useDiaryData` seeding.
    const zh = getSampleEntries('zh');
    expect(zh[0].id).toBe('sample-family-zh');
    expect(zh[1].id).toBe('sample-daily-zh');
  });

  it('samples are plain records without retired AI-analysis fields', () => {
    for (const entry of getSampleEntries('zh')) {
      expect('morningStarAnalysis' in entry).toBe(false);
      expect('morningStarPersonas' in entry).toBe(false);
    }
  });

  it('returns fresh objects so mutations do not leak into module-level constants', () => {
    const first = getSampleEntries('zh');
    const second = getSampleEntries('zh');
    first[0].title = 'mutated';
    first[0].tags.push('mutated');
    expect(second[0].title).not.toBe('mutated');
    expect(second[0].tags).not.toContain('mutated');
  });

  it('falls back to English samples for unsupported languages', () => {
    const ja = getSampleEntries('ja');
    expect(ja).toHaveLength(2);
    // The English family-memory id stays as `sample-family-en` (not
    // `sample-family-ja`) so consumers can detect the locale fallback.
    expect(ja[0].id).toBe('sample-family-en');
  });

  it('isSampleId correctly classifies user-generated ids', () => {
    expect(isSampleId('sample-anything-here')).toBe(true);
    expect(isSampleId('rec_abc123')).toBe(false);
    expect(isSampleId('')).toBe(false);
  });
});
