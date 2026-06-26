import { describe, expect, it } from 'vitest';
import { fingerprintToQrSvg } from './fingerprintQr';

describe('lib/fingerprintQr', () => {
  it('returns an inline SVG string (no XML preamble)', () => {
    const svg = fingerprintToQrSvg('ABCD-EFGH-IJKL-MNOP');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.includes('<?xml')).toBe(false);
  });

  it('respects the size option', () => {
    const svg = fingerprintToQrSvg('ABCD-EFGH-IJKL-MNOP', { size: 200 });
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="200"');
  });

  it('respects color overrides', () => {
    const svg = fingerprintToQrSvg('ABCD-EFGH-IJKL-MNOP', {
      color: '#abcdef',
      background: '#fff',
    });
    expect(svg.toLowerCase()).toContain('fill:#abcdef');
    expect(svg.toLowerCase()).toContain('fill:#fff');
  });

  it('defaults to currentColor + transparent background', () => {
    const svg = fingerprintToQrSvg('ABCD-EFGH-IJKL-MNOP');
    expect(svg).toContain('currentColor');
    expect(svg).toContain('transparent');
  });

  it('produces stable output for the same input (deterministic)', () => {
    const a = fingerprintToQrSvg('ABCD-EFGH-IJKL-MNOP');
    const b = fingerprintToQrSvg('ABCD-EFGH-IJKL-MNOP');
    expect(a).toBe(b);
  });

  it('produces different output for different inputs', () => {
    const a = fingerprintToQrSvg('ABCD-EFGH-IJKL-MNOP');
    const b = fingerprintToQrSvg('ZZZZ-EFGH-IJKL-MNOP');
    expect(a).not.toBe(b);
  });
});
