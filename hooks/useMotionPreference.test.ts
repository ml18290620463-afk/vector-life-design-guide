import { afterEach, describe, expect, it, vi } from 'vitest';
import { shouldReduceMotion, setMotionDisabled } from './useMotionPreference';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function device(query = '', cores = 8, memory = 8, saveData = false) {
  vi.stubGlobal('matchMedia', (value: string) => ({ matches: value === query }));
  vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(cores);
  Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: memory });
  Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData } });
}
describe('visual effects policy', () => {
  it('allows capable desktops and persists explicit disable', () => {
    device();
    expect(shouldReduceMotion()).toBe(false);
    setMotionDisabled(true);
    expect(shouldReduceMotion()).toBe(true);
    setMotionDisabled(false);
    expect(shouldReduceMotion()).toBe(false);
  });
  it.each(['(max-width: 767px)', '(pointer: coarse)', '(prefers-reduced-motion: reduce)'])(
    'reduces for %s',
    (query) => {
      device(query);
      expect(shouldReduceMotion()).toBe(true);
    },
  );
  it('reduces on constrained CPU, memory or data', () => {
    device('', 4);
    expect(shouldReduceMotion()).toBe(true);
    device('', 8, 4);
    expect(shouldReduceMotion()).toBe(true);
    device('', 8, 8, true);
    expect(shouldReduceMotion()).toBe(true);
  });
});
