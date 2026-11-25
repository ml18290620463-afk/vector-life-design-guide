import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clear } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import { ontologyPrivacyToken } from './aiPrivacy';
import { attestAvatarExtraction } from './avatarExtractionReceipt';
import {
  saveReviewedAvatarCognition,
  stageAvatarCognition,
  stageAvatarCognitions,
} from './avatarOntologyCandidates';
import {
  commitAvatarOntology,
  initializeAvatarOntology,
  persistAvatarOntologySession,
  readAvatarOntology,
} from './avatarOntologyStore';

beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
  await initializeAvatarOntology();
  await persistAvatarOntologySession(0, {
    id: 's1',
    mode: 'general',
    context: { mode: 'general', source: 'global' },
    createdAt: 1,
    updatedAt: 2,
    references: [],
    messages: [
      {
        aiPrivacyToken: ontologyPrivacyToken(await readAvatarOntology(), []),
        id: 'm1',
        role: 'user',
        type: 'text',
        content: '我喜欢安静',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        aiPrivacyToken: ontologyPrivacyToken(await readAvatarOntology(), []),
        id: 'a1',
        role: 'assistant',
        type: 'text',
        content: '你喜欢安静',
        created_at: '2026-01-01T00:00:01.000Z',
      },
    ],
  });
});
async function extraction() {
  return attestAvatarExtraction({
    kind: 'preference' as const,
    statement: '我喜欢安静',
    aiPrivacyToken: ontologyPrivacyToken(await readAvatarOntology(), []),
    evidenceAnchors: [
      {
        sourceId: 'm1',
        userMessageIndex: 0,
        verbatimQuote: '我喜欢安静',
        sourceOccurredAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  });
}
const choices = {
  expectedRevision: 1,
  sessionId: 's1',
  domain: 'about_me' as const,
  category: 'preferences_boundaries' as const,
  aiVisible: true,
};
describe('v2 extraction staging boundary', () => {
  it('stages a verified explicit expression without confirming it', async () => {
    const result = await stageAvatarCognition({ ...choices, extraction: await extraction() });
    expect(result.graph.objects[0]).toMatchObject({
      status: 'candidate',
      evidenceGate: { isReadyForConfirmation: true, distinctUserMessageCount: 1 },
    });
    expect(result.graph.edges[0]).toMatchObject({
      toId: 'm1',
      userMessageIndex: 0,
      quoteVerifiedByServer: true,
    });
  });
  it('rejects cloned/imported candidates without changing storage', async () => {
    await expect(
      stageAvatarCognition({ ...choices, extraction: structuredClone(await extraction()) }),
    ).rejects.toThrow('服务端核验');
    expect((await readAvatarOntology()).revision).toBe(1);
  });
  it('uses the original attested content when the UI object is mutated', async () => {
    const candidate = await extraction();
    candidate.statement = '伪造内容';
    candidate.evidenceAnchors[0].verbatimQuote = '伪造';
    const result = await stageAvatarCognition({ ...choices, extraction: candidate });
    expect(result.graph.objects[0].statement).toBe('我喜欢安静');
  });
  it('rejects assistant evidence and incorrect original message indices', async () => {
    for (const anchor of [
      { sourceId: 'a1', userMessageIndex: 1, verbatimQuote: '你喜欢安静' },
      { sourceId: 'm1', userMessageIndex: 1, verbatimQuote: '我喜欢安静' },
    ]) {
      const original = await extraction();
      const candidate = attestAvatarExtraction({
        ...original,
        evidenceAnchors: [{ ...original.evidenceAnchors[0], ...anchor }],
      });
      await expect(stageAvatarCognition({ ...choices, extraction: candidate })).rejects.toThrow(
        '原始用户引文',
      );
    }
    expect((await readAvatarOntology()).objects).toEqual([]);
  });
  it('cannot downgrade an inferred pattern to the explicit-expression gate', async () => {
    const candidate = attestAvatarExtraction({
      ...(await extraction()),
      kind: 'pattern_candidate' as const,
    });
    await expect(stageAvatarCognition({ ...choices, extraction: candidate })).rejects.toThrow(
      '分类',
    );
    const result = await stageAvatarCognition({
      ...choices,
      extraction: candidate,
      domain: 'my_understanding',
      category: 'understanding_judgment',
    });
    expect(result.graph.objects[0].evidenceGate.isReadyForConfirmation).toBe(false);
  });
  it('rejects replay even when the caller supplies the latest revision', async () => {
    const candidate = await extraction();
    await stageAvatarCognition({ ...choices, extraction: candidate });
    await expect(
      stageAvatarCognition({ ...choices, expectedRevision: 2, extraction: candidate }),
    ).rejects.toThrow('权限已变化');
    expect((await readAvatarOntology()).objects).toHaveLength(1);
  });
  it('does not turn goals into cognition writes', async () => {
    for (const kind of ['goal'] as const) {
      const candidate = attestAvatarExtraction({ ...(await extraction()), kind });
      await expect(stageAvatarCognition({ ...choices, extraction: candidate })).rejects.toThrow(
        '各自的显式保存',
      );
    }
  });
});

describe('explicit candidate selection transaction', () => {
  it('stages selected candidates against one token with one revision increment', async () => {
    const first = await extraction();
    const second = attestAvatarExtraction({ ...first, statement: '我偏好安静的环境' });
    const result = await stageAvatarCognitions({
      expectedRevision: 1,
      selections: [first, second].map((candidate) => ({ ...choices, extraction: candidate })),
    });
    expect(result.graph.revision).toBe(2);
    expect(result.objectIds).toHaveLength(2);
    expect(result.graph.objects.map((object) => object.status)).toEqual(['candidate', 'candidate']);
    await expect(
      stageAvatarCognition({ ...choices, expectedRevision: 2, extraction: second }),
    ).rejects.toThrow('权限已变化');
  });
  it('rolls back the entire selection when the last candidate has invalid evidence', async () => {
    const first = await extraction();
    const invalid = attestAvatarExtraction({
      ...first,
      evidenceAnchors: [{ ...first.evidenceAnchors[0], userMessageIndex: 1 }],
    });
    await expect(
      stageAvatarCognitions({
        expectedRevision: 1,
        selections: [first, invalid].map((candidate) => ({ ...choices, extraction: candidate })),
      }),
    ).rejects.toThrow('原始用户引文');
    expect((await readAvatarOntology()).objects).toEqual([]);
    expect((await readAvatarOntology()).revision).toBe(1);
  });
  it('rejects duplicate selections and oversized or empty selections without writing', async () => {
    const candidate = await extraction();
    for (const count of [0, 2, 4]) {
      await expect(
        stageAvatarCognitions({
          expectedRevision: 1,
          selections: Array.from({ length: count }, () => ({ ...choices, extraction: candidate })),
        }),
      ).rejects.toThrow();
    }
    expect((await readAvatarOntology()).objects).toEqual([]);
  });
  it('rejects a stale receipt anywhere in a selection without partial persistence', async () => {
    const first = await extraction();
    const stale = attestAvatarExtraction({ ...first, aiPrivacyToken: 'stale' });
    await expect(
      stageAvatarCognitions({
        expectedRevision: 1,
        selections: [first, stale].map((candidate) => ({ ...choices, extraction: candidate })),
      }),
    ).rejects.toThrow('权限已变化');
    expect((await readAvatarOntology()).revision).toBe(1);
  });
});

describe('atomic explicit review', () => {
  it('confirms verified about-me evidence with one commit', async () => {
    const candidate = await extraction();
    const result = await saveReviewedAvatarCognition({
      ...choices,
      extraction: candidate,
      statement: candidate.statement,
    });
    expect(result.graph.revision).toBe(2);
    expect(result.graph.objects).toHaveLength(1);
    expect(result.graph.objects[0]).toMatchObject({
      status: 'confirmed',
      version: 1,
      evidenceGate: { isReadyForConfirmation: true },
    });
    expect(result.graph.objects[0].confirmedAt).toBeTruthy();
    expect(await readAvatarOntology()).toEqual(result.graph);
  });
  it('retains an insufficient pattern without activating or superseding it', async () => {
    const candidate = attestAvatarExtraction({
      ...(await extraction()),
      kind: 'pattern_candidate' as const,
    });
    const result = await saveReviewedAvatarCognition({
      ...choices,
      extraction: candidate,
      statement: candidate.statement,
      domain: 'my_understanding',
      category: 'understanding_judgment',
    });
    expect(result.graph.objects[0].status).toBe('candidate');
    expect(result.graph.objects[0].confirmedAt).toBeUndefined();
    expect(result.graph.edges.some((edge) => edge.type === 'SUPERSEDES')).toBe(false);
  });
  it('does not persist a candidate when revision validation fails', async () => {
    const candidate = await extraction();
    await expect(
      saveReviewedAvatarCognition({
        ...choices,
        extraction: candidate,
        statement: candidate.statement,
        revision: { previousObjectId: 'missing' },
      }),
    ).rejects.toThrow('同类观点');
    expect((await readAvatarOntology()).revision).toBe(1);
    expect((await readAvatarOntology()).objects).toEqual([]);
  });
  it('rejects edited review text instead of saving unseen attested text', async () => {
    const candidate = await extraction();
    await expect(
      saveReviewedAvatarCognition({
        ...choices,
        extraction: candidate,
        statement: '我喜欢热闹',
      }),
    ).rejects.toThrow('重新核验');
    expect((await readAvatarOntology()).objects).toEqual([]);
  });
  it('atomically replaces a confirmed same-category opinion and preserves its lineage', async () => {
    const first = await extraction();
    const previous = await saveReviewedAvatarCognition({
      ...choices,
      extraction: first,
      statement: first.statement,
    });
    const candidate = attestAvatarExtraction({
      ...(await extraction()),
      statement: '我偏好安静的环境',
    });
    const result = await saveReviewedAvatarCognition({
      ...choices,
      expectedRevision: 2,
      extraction: candidate,
      statement: candidate.statement,
      revision: { previousObjectId: previous.objectId, reason: '更准确的表达' },
    });
    expect(result.graph.revision).toBe(3);
    expect(result.graph.objects.map((object) => object.status)).toEqual([
      'superseded',
      'confirmed',
    ]);
    expect(result.graph.objects[1]).toMatchObject({ version: 2, lineageId: previous.objectId });
    expect(result.graph.edges.filter((edge) => edge.type === 'SUPERSEDES')).toEqual([
      expect.objectContaining({ fromId: result.objectId, toId: previous.objectId }),
    ]);
  });
});

describe('candidate edit transaction', () => {
  it('replaces a candidate in place without manufacturing a viewpoint revision', async () => {
    const previous = await stageAvatarCognition({ ...choices, extraction: await extraction() });
    const candidate = attestAvatarExtraction({
      ...(await extraction()),
      statement: '我偏好安静的环境',
    });
    const result = await saveReviewedAvatarCognition({
      ...choices,
      expectedRevision: 2,
      extraction: candidate,
      statement: candidate.statement,
      replacesCandidateId: previous.objectId,
    });
    expect(result.objectId).toBe(previous.objectId);
    expect(result.graph.objects).toHaveLength(1);
    expect(result.graph.objects[0]).toMatchObject({
      status: 'confirmed',
      statement: candidate.statement,
      createdAt: previous.graph.objects[0].createdAt,
      version: 1,
      lineageId: previous.graph.objects[0].lineageId,
    });
    expect(result.graph.edges).toHaveLength(1);
    expect(result.graph.edges[0].type).toBe('EVIDENCED_BY');
  });
  it('cannot replace a confirmed object through the candidate edit path', async () => {
    const first = await extraction();
    const previous = await saveReviewedAvatarCognition({
      ...choices,
      extraction: first,
      statement: first.statement,
    });
    const candidate = await extraction();
    await expect(
      saveReviewedAvatarCognition({
        ...choices,
        expectedRevision: 2,
        extraction: candidate,
        statement: candidate.statement,
        replacesCandidateId: previous.objectId,
      }),
    ).rejects.toThrow('待审核认知已变化');
    expect(await readAvatarOntology()).toEqual(previous.graph);
  });
  it('rolls back candidate editing when fresh evidence is invalid', async () => {
    const previous = await stageAvatarCognition({ ...choices, extraction: await extraction() });
    const valid = await extraction();
    const candidate = attestAvatarExtraction({
      ...valid,
      evidenceAnchors: [{ ...valid.evidenceAnchors[0], sourceId: 'a1', userMessageIndex: 1 }],
    });
    await expect(
      saveReviewedAvatarCognition({
        ...choices,
        expectedRevision: 2,
        extraction: candidate,
        statement: candidate.statement,
        replacesCandidateId: previous.objectId,
      }),
    ).rejects.toThrow('原始用户引文');
    expect(await readAvatarOntology()).toEqual(previous.graph);
  });
});

describe('single-source history preservation', () => {
  it('links a verified different-validity expression as tension without superseding history', async () => {
    const first = await extraction();
    const saved = await saveReviewedAvatarCognition({
      ...choices, extraction: first, statement: first.statement,
    });
    const historical = await commitAvatarOntology(saved.graph.revision, (graph) => {
      graph.objects[0].validity = { mode: 'staged', validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2026-02-01T00:00:00.000Z' };
    });
    const candidate = attestAvatarExtraction({
      ...(await extraction()),
      action: 'create_new' as const,
      replacesReferenceId: saved.objectId,
      statement: '我喜欢热闹',
    });
    const result = await saveReviewedAvatarCognition({
      ...choices, expectedRevision: historical.revision,
      extraction: candidate, statement: candidate.statement,
    });
    expect(result.graph.objects).toHaveLength(2);
    expect(result.graph.objects[0].status).toBe('confirmed');
    expect(result.graph.edges).toContainEqual(expect.objectContaining({
      type: 'TENSION_WITH', fromId: result.objectId, toId: saved.objectId,
    }));
    expect(result.graph.edges.some((edge) => edge.type === 'SUPERSEDES')).toBe(false);
  });
  it('requires explicit revision for a conflicting same-validity expression', async () => {
    const first = await extraction();
    const saved = await saveReviewedAvatarCognition({
      ...choices, extraction: first, statement: first.statement,
    });
    const candidate = attestAvatarExtraction({
      ...(await extraction()), action: 'create_new' as const,
      replacesReferenceId: saved.objectId, statement: '我喜欢热闹',
    });
    await expect(stageAvatarCognition({
      ...choices, expectedRevision: saved.graph.revision, extraction: candidate,
    })).rejects.toThrow('显式修订');
    expect((await readAvatarOntology()).objects).toHaveLength(1);
  });
  it('fresh extraction cannot overwrite confirmed cognition or its evidence', async () => {
    const first = await extraction();
    const saved = await saveReviewedAvatarCognition({
      ...choices,
      extraction: first,
      statement: first.statement,
    });
    const next = await stageAvatarCognition({
      ...choices,
      expectedRevision: saved.graph.revision,
      extraction: await extraction(),
    });
    expect(next.graph.objects.find((object) => object.id === saved.objectId)).toEqual(
      saved.graph.objects[0],
    );
    expect(next.graph.edges.filter((edge) => edge.fromId === saved.objectId)).toEqual(
      saved.graph.edges,
    );
    expect(next.objectId).toBe(saved.objectId);
    expect(next.graph.objects.map((object) => object.status)).toEqual(['confirmed']);
  });
  it('reinforces a narrow wording variant without creating a second object', async () => {
    const first = await extraction();
    const saved = await saveReviewedAvatarCognition({
      ...choices, extraction: first, statement: first.statement,
    });
    const variant = attestAvatarExtraction({
      ...(await extraction()),
      action: 'reinforce_existing' as const,
      targetObjectId: saved.objectId,
      statement: '我偏好安静',
    });
    const reinforced = await saveReviewedAvatarCognition({
      ...choices,
      expectedRevision: saved.graph.revision,
      extraction: variant,
      statement: variant.statement,
    });
    expect(reinforced.objectId).toBe(saved.objectId);
    expect(reinforced.graph.objects).toHaveLength(1);
    expect(reinforced.graph.objects[0].status).toBe('confirmed');
  });
  it('serializes two concurrent explicit confirmations of the same candidate', async () => {
    const candidate = await extraction();
    const results = await Promise.allSettled([
      saveReviewedAvatarCognition({ ...choices, extraction: candidate, statement: candidate.statement }),
      saveReviewedAvatarCognition({ ...choices, extraction: candidate, statement: candidate.statement }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const graph = await readAvatarOntology();
    expect(graph.objects).toHaveLength(1);
    expect(graph.objects[0].status).toBe('confirmed');
    expect(graph.revision).toBe(2);
  });
  it('reading after 48 hours never prunes candidates or confirmed history', async () => {
    const first = await extraction();
    const saved = await saveReviewedAvatarCognition({
      ...choices,
      extraction: first,
      statement: first.statement,
    });
    const staged = await stageAvatarCognition({
      ...choices,
      expectedRevision: saved.graph.revision,
      extraction: await extraction(),
    });
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 48 * 60 * 60 * 1000);
    try {
      expect(await readAvatarOntology()).toEqual(staged.graph);
      expect(await readAvatarOntology()).toEqual(staged.graph);
    } finally {
      clock.mockRestore();
    }
  });
});
