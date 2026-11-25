import { LEGACY_INFERRED_CATEGORIES, LEGACY_EXPLICIT_CATEGORIES } from './avatarLegacyTypes';
import type {
  RawStore,
  AvatarMigrationResult,
  LegacyAvatarAtomicMemory,
  LegacyAvatarUnderstandingVersion,
} from './avatarLegacyTypes';
import type { CognitiveCategory, CognitiveObject } from '../features/avatar/types';
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const iso = (v: unknown): string | undefined =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 8.64e15
    ? new Date(v).toISOString()
    : undefined;

/** Never calls legacy readers: they prune expired candidates and truncate large stores. */
export function convertAvatarV1Snapshot(raw: RawStore): AvatarMigrationResult {
  const output: AvatarMigrationResult = {
    ontologySchemaVersion: 2,
    objects: [],
    edges: [],
    archive: [],
    diagnostics: [],
  };
  const diagnostic = (collection: keyof RawStore, index: number, code: string) =>
    output.diagnostics.push({ collection, index, code });
  const parse = (key: keyof RawStore): unknown[] => {
    if (raw[key] === null) return [];
    try {
      const value: unknown = JSON.parse(raw[key]);
      if (Array.isArray(value)) return value;
    } catch {
      /* Original bytes remain in the verified snapshot. */
    }
    diagnostic(key, -1, 'invalid_collection_preserved');
    return [];
  };
  const understandings = parse('understandings');
  const atoms = parse('atoms');
  const relations = parse('relations');
  parse('sessions');
  const tags = parse('tags');
  tags.forEach((_, i) => diagnostic('tags', i, 'tag_provenance_unverified'));
  const owners = new Map<string, CognitiveObject>();
  const seen = new Set<string>();
  const add = (item: unknown, collection: 'understandings' | 'atoms', index: number) => {
    if (
      !record(item) ||
      typeof item.id !== 'string' ||
      !item.id ||
      typeof item.statement !== 'string' ||
      !item.statement.trim() ||
      !iso(item.createdAt)
    ) {
      diagnostic(collection, index, 'invalid_record_preserved');
      return;
    }
    const identity = `${collection}:${item.id}`;
    if (seen.has(identity)) {
      diagnostic(collection, index, 'duplicate_id_preserved');
      return;
    }
    seen.add(identity);
    const u = item as unknown as LegacyAvatarUnderstandingVersion;
    const a = item as unknown as LegacyAvatarAtomicMemory;
    const understanding = collection === 'understandings';
    if (!understanding && ['experience', 'commitment'].includes(a.nature)) {
      output.archive.push({ readOnly: true, sourceNotExtractable: true, value: item });
      return;
    }
    const statuses = understanding
      ? ['pending', 'confirmed', 'rejected', 'superseded']
      : ['candidate', 'confirmed', 'rejected', 'superseded', 'retained'];
    if (
      !statuses.includes(String(item.status)) ||
      (!understanding && !['explicit', 'state', 'inferred'].includes(a.nature))
    ) {
      diagnostic(collection, index, 'unknown_status_or_nature');
      return;
    }
    const refs = Array.isArray(a.sourceRefs) ? a.sourceRefs.filter(record) : [];
    // Only exact provenance and text matches can collapse a materialized understanding.
    const ownerRef = refs.find((ref) => ref.source === 'pattern' && typeof ref.id === 'string');
    const owner = ownerRef && typeof ownerRef.id === 'string' ? owners.get(ownerRef.id) : undefined;
    if (!understanding && a.nature === 'inferred' && owner && owner.statement === a.statement) {
      if (
        owner.migration!.legacyStatus !== a.status ||
        owner.privacy.traceabilityDegraded !==
          Boolean(a.retainedAfterSourceDeletion || a.status === 'retained')
      ) {
        diagnostic(collection, index, 'projection_lifecycle_conflict_preserved');
        return;
      }
      owner.migration!.legacyIds.push(identity);
      owner.migration!.diagnostics.push('duplicate_projection_preserved_in_snapshot');
      // A duplicate never grants additional permission or confirmation.
      owner.privacy.aiVisible = false;
      if (a.sensitivity === 'private') owner.privacy.sensitivity = 'high';
      diagnostic(collection, index, 'duplicate_projection_merged');
      return;
    }
    const inferred = understanding || a.nature === 'inferred';
    const category = categoryFor(item, inferred);
    if (!category) {
      diagnostic(collection, index, 'category_requires_review');
      return;
    }
    const from = iso(a.validFrom ?? item.createdAt)!;
    const until = a.validTo === undefined ? undefined : iso(a.validTo);
    if (
      !from ||
      (a.validTo !== undefined && (!until || until <= from)) ||
      (!understanding && a.nature === 'state' && !until)
    ) {
      diagnostic(collection, index, 'validity_requires_review');
      return;
    }
    const entries = understanding
      ? u.sourceEntryIds
      : refs.filter((r) => r.source === 'entry').map((r) => r.id);
    const hasEntries = Array.isArray(entries) && entries.some((id) => typeof id === 'string');
    const hasMessages = refs.some((r) => r.source === 'message');
    if (!hasEntries && !hasMessages) {
      diagnostic(collection, index, 'origin_requires_review');
      return;
    }
    const flags = ['legacy_evidence_requires_server_verification'];
    if (item.status === 'confirmed') flags.push('legacy_confirmation_requires_review');
    const retained = item.retainedAfterSourceDeletion === true || item.status === 'retained';
    const object: CognitiveObject = {
      id: `v2:${identity}`,
      schemaVersion: 2,
      domain: inferred ? 'my_understanding' : 'about_me',
      category,
      statement: item.statement,
      status:
        item.status === 'rejected'
          ? 'rejected'
          : item.status === 'superseded'
            ? 'superseded'
            : retained
              ? 'retained_after_source_delete'
              : 'candidate',
      validity: {
        mode: until ? 'staged' : 'long_term',
        validFrom: from,
        ...(until ? { validUntil: until } : {}),
      },
      privacy: {
        sensitivity:
          a.sensitivity === 'private'
            ? 'high'
            : a.sensitivity === 'sensitive' || understanding
              ? 'sensitive'
              : 'normal',
        aiVisible: false,
        traceabilityDegraded: retained,
      },
      // No v1 reference proves a server-verified quote; none contributes to the v2 gate.
      evidenceGate: {
        requiresMultiSourceGate: inferred,
        independentExperienceCount: 0,
        distinctUserMessageCount: 0,
        distinctDateCount: 0,
        distinctSessionCount: 0,
        // Historical confirmation is not server-verified user evidence.
        // Explicit expressions also need at least one verified original quote.
        isReadyForConfirmation: false,
      },
      confidenceScore:
        typeof a.confidence === 'number' && Number.isFinite(a.confidence)
          ? Math.min(1, Math.max(0, a.confidence))
          : 0,
      reinforcementCount: 0,
      version: 1,
      lineageId: `v2:${identity}`,
      origin: hasEntries ? 'distilled_from_record' : 'extracted_from_chat',
      createdAt: iso(item.createdAt)!,
      updatedAt: iso(item.updatedAt) ?? iso(item.createdAt)!,
      migration: {
        legacyIds: [identity],
        legacyStatus: String(item.status),
        ...(iso(item.confirmedAt) ? { legacyConfirmedAt: iso(item.confirmedAt) } : {}),
        diagnostics: flags,
      },
    };
    output.objects.push(object);
    if (understanding) owners.set(u.id, object);
    flags.forEach((code) => diagnostic(collection, index, code));
  };
  understandings.forEach((v, i) => add(v, 'understandings', i));
  atoms.forEach((v, i) => add(v, 'atoms', i));
  // Preserve an explicit, user-confirmed historical revision, never infer one from similarity.
  // Candidate successors remain candidates: this edge records history, not proven growth.
  const revisions = new Map<
    string,
    {
      previous: CognitiveObject;
      current: CognitiveObject;
      at: string;
      collection: 'atoms' | 'understandings';
      index: number;
    }
  >();
  for (const collection of ['understandings', 'atoms'] as const) {
    const rows = collection === 'atoms' ? atoms : understandings;
    rows.forEach((row, index) => {
      if (!record(row) || !row.previousVersionId) return;
      const current = output.objects.find((o) => o.id === `v2:${collection}:${row.id}`);
      const previous = output.objects.find(
        (o) => o.id === `v2:${collection}:${row.previousVersionId}`,
      );
      const at = iso(row.confirmedAt);
      const unique = (id: unknown) => rows.filter((r) => record(r) && r.id === id).length === 1;
      if (
        !current ||
        !previous ||
        !unique(row.id) ||
        !unique(row.previousVersionId) ||
        !at ||
        row.confirmedBy !== 'user' ||
        !['confirmed', 'superseded'].includes(String(row.status)) ||
        previous.status !== 'superseded' ||
        current.domain !== previous.domain ||
        current.category !== previous.category ||
        at < current.createdAt ||
        at < previous.createdAt ||
        current.id === previous.id
      ) {
        diagnostic(collection, index, 'revision_provenance_requires_review');
        return;
      }
      revisions.set(current.id, { previous, current, at, collection, index });
    });
  }
  const ambiguous = new Set<string>();
  for (const [id, revision] of revisions) {
    const visited = new Set<string>();
    let cursor: string | undefined = id;
    while (cursor && revisions.has(cursor)) {
      if (visited.has(cursor)) {
        visited.forEach((key) => ambiguous.add(key));
        break;
      }
      visited.add(cursor);
      cursor = revisions.get(cursor)?.previous.id;
    }
    if ([...revisions.values()].filter((r) => r.previous.id === revision.previous.id).length > 1)
      ambiguous.add(id);
  }
  // Propagate ambiguity through successors rather than manufacturing a partial lineage.
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, revision] of revisions)
      if (!ambiguous.has(id) && ambiguous.has(revision.previous.id)) {
        ambiguous.add(id);
        changed = true;
      }
  }
  for (const [id, revision] of revisions) {
    if (ambiguous.has(id)) {
      diagnostic(revision.collection, revision.index, 'revision_chain_ambiguous');
      continue;
    }
    let root = revision.previous;
    let version = 2;
    while (revisions.has(root.id)) {
      root = revisions.get(root.id)!.previous;
      version++;
    }
    revision.current.lineageId = root.id;
    revision.current.version = version;
    output.edges.push({
      id: `v2:revision:${id}`,
      schemaVersion: 2,
      type: 'SUPERSEDES',
      fromId: id,
      toId: revision.previous.id,
      createdAt: revision.at,
      confirmedByUserAt: revision.at,
    });
  }
  // Only endpoints which survived conservative classification can form a tension.
  const byLegacyId = new Map<string, CognitiveObject[]>();
  output.objects.forEach((object) =>
    object.migration!.legacyIds.forEach((identity) => {
      const id = identity.slice(identity.indexOf(':') + 1);
      byLegacyId.set(id, [...(byLegacyId.get(id) ?? []), object]);
    }),
  );
  relations.forEach((relation, index) => {
    if (!record(relation)) {
      diagnostic('relations', index, 'invalid_relation_preserved');
      return;
    }
    const from = byLegacyId.get(String(relation.fromId));
    const to = byLegacyId.get(String(relation.toId));
    if (
      ['contradicts', 'constrains'].includes(String(relation.kind)) &&
      [...atoms, ...understandings].filter((r) => record(r) && r.id === relation.fromId).length ===
        1 &&
      [...atoms, ...understandings].filter((r) => record(r) && r.id === relation.toId).length ===
        1 &&
      from?.length === 1 &&
      to?.length === 1 &&
      from[0].id !== to[0].id &&
      typeof relation.reason === 'string' &&
      relation.reason.trim() &&
      iso(relation.createdAt)
    ) {
      output.edges.push({
        id: `v2:tension:${index}`,
        schemaVersion: 2,
        type: 'TENSION_WITH',
        fromId: from[0].id,
        toId: to[0].id,
        createdAt: iso(relation.createdAt)!,
        targetKind: 'cognitive_object',
        tensionSummary: relation.reason,
        status: 'active',
      });
    } else diagnostic('relations', index, 'relation_provenance_requires_review');
  });
  return output;
}

function categoryFor(
  item: Record<string, unknown>,
  inferred: boolean,
): CognitiveCategory | undefined {
  const map = inferred ? LEGACY_INFERRED_CATEGORIES : LEGACY_EXPLICIT_CATEGORIES;
  const keys =
    typeof item.patternDomain === 'string'
      ? [item.patternDomain]
      : Array.isArray(item.facets)
        ? item.facets
        : [];
  const categories = new Set(keys.map((key) => (typeof key === 'string' ? map[key] : undefined)));
  return categories.size === 1 ? [...categories][0] : undefined;
}
