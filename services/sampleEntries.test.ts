import { describe, expect, it } from 'vitest';
import { getSampleEntries, isSampleId, SAMPLE_PERSONA_PLACEHOLDER } from './sampleEntries';

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

  it('first sample is the memoir teaser, second is the daily reflection', () => {
    // The Dashboard shows newest first; getSampleEntries returns
    // [memoir, daily] so the more emotionally weighty teaser sits on
    // top. This pin protects the ordering contract relied on by
    // `useDiaryData` seeding logic.
    const zh = getSampleEntries('zh');
    expect(zh[0].id).toBe('sample-memoir-zh');
    expect(zh[1].id).toBe('sample-daily-zh');
  });

  it('memoir teaser uses the placeholder persona, daily uses Camus', () => {
    const [memoir, daily] = getSampleEntries('zh');
    expect(memoir.morningStarPersonas).toContain(SAMPLE_PERSONA_PLACEHOLDER);
    expect(daily.morningStarPersonas).toContain('Albert Camus');
  });

  it('every sample ships a pre-attached morningStarAnalysis (no live AI call)', () => {
    for (const entry of getSampleEntries('zh')) {
      expect(entry.morningStarAnalysis).toBeTruthy();
      expect(entry.morningStarAnalysis!.length).toBeGreaterThan(50);
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
    // The English memoir teaser id stays as `sample-memoir-en` (not
    // `sample-memoir-ja`) so consumers can detect the locale fallback.
    expect(ja[0].id).toBe('sample-memoir-en');
  });

  it('isSampleId correctly classifies user-generated ids', () => {
    expect(isSampleId('sample-anything-here')).toBe(true);
    expect(isSampleId('rec_abc123')).toBe(false);
    expect(isSampleId('')).toBe(false);
  });
});
