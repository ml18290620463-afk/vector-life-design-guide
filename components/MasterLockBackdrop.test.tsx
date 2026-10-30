import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MasterLockBackdrop } from './MasterLockBackdrop';

describe('MasterLockBackdrop', () => {
  it.each(['light', 'dark'] as const)(
    'keeps %s decoration hidden from assistive technology and pointer interaction',
    (theme) => {
      const { container } = render(<MasterLockBackdrop theme={theme} />);
      const decoration = container.firstChild as HTMLElement;
      expect(decoration.getAttribute('aria-hidden')).toBe('true');
      expect(decoration.className).toContain('pointer-events-none');
      expect(decoration.querySelector('button, input, a, [tabindex]')).toBeNull();
    },
  );
});
