import { render, cleanup } from '@testing-library/react';
import { DecryptionText } from './DecryptionText';
import { describe, it, expect, afterEach } from 'vitest';

describe('DecryptionText', () => {
  afterEach(cleanup);

  it('renders correctly', () => {
    const { container } = render(<DecryptionText text="Hello" />);
    expect(container.firstChild).toBeDefined();
  });
});
