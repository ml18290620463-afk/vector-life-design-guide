import React from 'react';
import { LockKeyhole } from 'lucide-react';

/** Decorative privacy marker; the adjacent label supplies the accessible name. */
export function PrivateVisibilityIcon() {
  return <LockKeyhole aria-hidden="true" size={12} strokeWidth={1.6} style={{ display: 'inline-block', verticalAlign: '-0.12em', marginRight: 4, flexShrink: 0 }} />;
}
