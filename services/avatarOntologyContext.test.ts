import { describe, expect, it } from 'vitest';
import { cognition, evidenceGraph } from '../tests/fixtures/avatarOntology';
import { ontologyPrivacyToken } from './aiPrivacy';
import { selectAvatarOntologyContext } from './avatarOntologyContext';
import type { DiaryEntry } from '../types';

const entries: DiaryEntry[] = [1, 2, 3].map((n) => ({
  id: `e${n}`,
  title: '',
  content: `原话${n}`,
  createdAt: n * 86400000,
  tags: [],
  aiVisibility: 'allowed',
  isLocked: false,
}));
const now = 10 * 86400000;
const select = (graph: ReturnType<typeof evidenceGraph>, live = entries) =>
  selectAvatarOntologyContext(graph, live, ontologyPrivacyToken(graph, live), now);

describe('native ontology context', () => {
  it('derives the multi-source gate from live records, ignoring stale stored counters', () => {
    const object = cognition();
    expect(select(evidenceGraph([object], entries))).toHaveLength(1);
    expect(select(evidenceGraph([object], [entries[0]]))).toEqual([]);
    expect(
      select(
        evidenceGraph([object], entries),
        entries.map((e) => ({ ...e, createdAt: 1 })),
      ),
    ).toEqual([]);
  });
  it('allows explicit about-me statements with one verified original', () => {
    expect(
      select(
        evidenceGraph(
          [cognition({ domain: 'about_me', category: 'foundation_situation' })],
          [entries[0]],
        ),
      ),
    ).toHaveLength(1);
  });
  it.each([
    'candidate',
    'rejected',
    'superseded',
    'retained_after_source_delete',
    'archived_expired',
  ] as const)('excludes %s', (status) => {
    expect(select(evidenceGraph([cognition({ status })], entries))).toEqual([]);
  });
  it('blocks all context when even one source is revoked, despite two surviving records', () => {
    const graph = evidenceGraph([cognition()], entries);
    for (const patch of [
      { aiVisibility: 'private' as const },
      { isLocked: true },
      { isEncrypted: true },
      { unlockAt: now + Date.now() },
      { isSample: true },
      { content: '原文已修改' },
    ]) {
      expect(
        select(
          graph,
          entries.map((e, i) => (i ? e : { ...e, ...patch })),
        ),
      ).toEqual([]);
    }
    expect(select(graph, entries.slice(1))).toEqual([]);
  });
  it('excludes future and expired validity without mutating the graph', () => {
    const graph = evidenceGraph(
      [
        cognition({
          validity: {
            mode: 'staged',
            validFrom: new Date(0).toISOString(),
            validUntil: new Date(now).toISOString(),
          },
        }),
      ],
      entries,
    );
    const original = structuredClone(graph);
    expect(select(graph)).toEqual([]);
    expect(graph).toEqual(original);
    graph.objects[0].validity = { mode: 'long_term', validFrom: new Date(now + 1).toISOString() };
    expect(select(graph)).toEqual([]);
  });
  it('rejects unverified quotation and hidden cognition', () => {
    const graph = evidenceGraph([cognition()], entries);
    const edge = graph.edges[0];
    if (edge.type === 'EVIDENCED_BY') edge.quoteVerifiedByServer = false;
    expect(select(graph)).toEqual([]);
    graph.objects[0].privacy.aiVisible = false;
    expect(select(graph)).toEqual([]);
  });
});

it('counts actual privacy/expiry filtering and rechecks expanded historical evidence', () => {
  const expired = cognition({
    status: 'archived_expired',
    validity: {
      mode: 'staged',
      validFrom: new Date(0).toISOString(),
      validUntil: new Date(now - 1).toISOString(),
    },
  });
  const graph = evidenceGraph([expired], entries);
  const diagnostics = { privacyCount: 0, expiryCount: 0 };
  expect(
    selectAvatarOntologyContext(
      graph,
      entries,
      ontologyPrivacyToken(graph, entries),
      now,
      false,
      diagnostics,
    ),
  ).toEqual([]);
  expect(diagnostics).toEqual({ privacyCount: 0, expiryCount: 1 });
  expect(
    selectAvatarOntologyContext(graph, entries, ontologyPrivacyToken(graph, entries), now, true),
  ).toHaveLength(1);
  const revoked = entries.map((e, i) => (i ? e : { ...e, aiVisibility: 'private' as const }));
  expect(
    selectAvatarOntologyContext(
      graph,
      revoked,
      ontologyPrivacyToken(graph, revoked),
      now,
      true,
      diagnostics,
    ),
  ).toEqual([]);
  expect(diagnostics.privacyCount).toBe(1);
});
