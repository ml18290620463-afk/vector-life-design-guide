/** Whitelisted reference data, shared by hosted and personal model paths. */
const kinds = new Set([
  '模式',
  '原则',
  '行动',
  '愿景',
  '目标',
  '偏好',
  '边界',
  '驱动',
  '触点',
  '背景',
]);
const natures = new Set(['experience', 'explicit', 'inferred', 'commitment', 'state']);
const boundedText = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
const optionalText = (v: unknown, max: number) => v === undefined || boundedText(v, max);
const optionalTime = (v: unknown) =>
  v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
export function isGuidanceContext(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const m = value as Record<string, unknown>;
  return (
    boundedText(m.text, 4000) &&
    (m.text as string).trim().length > 0 &&
    optionalText(m.detail, 2400) &&
    optionalText(m.status, 40) &&
    (m.kind === undefined || kinds.has(m.kind as string)) &&
    (m.nature === undefined || natures.has(m.nature as string)) &&
    optionalTime(m.validFrom) &&
    optionalTime(m.validTo) &&
    (m.evidence === undefined ||
      (Array.isArray(m.evidence) &&
        m.evidence.length <= 3 &&
        m.evidence.every(
          (e) =>
            e &&
            boundedText(e.text, 700) &&
            typeof e.occurredAt === 'number' &&
            optionalTime(e.occurredAt),
        ))) &&
    (m.results === undefined ||
      (Array.isArray(m.results) &&
        m.results.length <= 4 &&
        m.results.every(
          (r) =>
            r &&
            boundedText(r.text, 700) &&
            boundedText(r.status, 40) &&
            typeof r.occurredOn === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(r.occurredOn),
        )))
  );
}
export function serializeGuidanceContext(memories: Record<string, unknown>[]) {
  return memories.map((m) => ({
    text: m.text,
    nature: m.nature,
    kind: m.kind,
    detail: m.detail,
    status: m.status,
    validFrom: m.validFrom,
    validTo: m.validTo,
    evidence: Array.isArray(m.evidence)
      ? m.evidence.map((e) => ({ text: e.text, occurredAt: e.occurredAt }))
      : undefined,
    results: Array.isArray(m.results)
      ? m.results.map((r) => ({ text: r.text, occurredOn: r.occurredOn, status: r.status }))
      : undefined,
  }));
}
