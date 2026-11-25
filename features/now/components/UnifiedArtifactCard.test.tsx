import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UnifiedArtifactCard } from './UnifiedArtifactCard';

describe('UnifiedArtifactCard', () => {
  it('marks a draft as requiring an explicit save', () => {
    render(<UnifiedArtifactCard kind="record">待保存内容</UnifiedArtifactCard>);
    expect(screen.getByText('草稿')).toBeTruthy();
    expect(screen.getByText(/对话回复不会自动保存/)).toBeTruthy();
  });

  it('does not present a saved artifact as awaiting confirmation', () => {
    render(<UnifiedArtifactCard kind="memory" status="active">已确认内容</UnifiedArtifactCard>);
    expect(screen.getByText('已生效')).toBeTruthy();
    expect(screen.queryByText(/对话回复不会自动保存/)).toBeNull();
  });
});
