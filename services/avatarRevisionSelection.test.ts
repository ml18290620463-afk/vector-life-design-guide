import { expect, it } from 'vitest';
import { cognition } from '../tests/fixtures/avatarOntology';
import { selectRevisionCandidates } from './avatarRevisionSelection';
import type { ChatMessage } from '../features/now/types/now';
const messages: ChatMessage[] = [
  { id: 'old', role: 'user', type: 'text', content: '过去的表达', created_at: '2026-01-01' },
  { id: 'assistant', role: 'assistant', type: 'text', content: '建议', created_at: '2026-01-01' },
  { id: 'edit', role: 'user', type: 'text', content: '我的修订', created_at: '2026-01-02' },
];
const candidate = { kind: 'pattern_candidate' as const,
  evidenceAnchors: [{ sourceId: 'edit', userMessageIndex: 2 }] };
it('preserves the receipt identity of a candidate grounded in the new edit', () => {
  expect(selectRevisionCandidates([candidate], messages, cognition())[0]).toBe(candidate);
});
it('rejects unrelated older sources, assistant evidence and mismatched indices', () => {
  for (const anchor of [
    { sourceId: 'old', userMessageIndex: 0 },
    { sourceId: 'assistant', userMessageIndex: 1 },
    { sourceId: 'edit', userMessageIndex: 0 },
  ]) expect(selectRevisionCandidates([{ ...candidate, evidenceAnchors: [anchor] }], messages, cognition())).toEqual([]);
});
it('does not turn a revision into a different domain or goal', () => {
  for (const kind of ['profile', 'goal'] as const)
    expect(selectRevisionCandidates([{ ...candidate, kind }], messages, cognition())).toEqual([]);
  expect(selectRevisionCandidates([candidate], messages, cognition({ status: 'rejected' }))).toEqual([]);
});

it('permits re-verification of candidates and retained statements without treating them as confirmed revisions', () => {
  for (const status of ['candidate', 'retained_after_source_delete'] as const)
    expect(selectRevisionCandidates([candidate], messages, cognition({ status }))[0]).toBe(candidate);
});
