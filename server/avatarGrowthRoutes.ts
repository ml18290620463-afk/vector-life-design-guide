import type { Express } from 'express';
import type { DiaryEntry } from '../types';
import type { AvatarUnderstandingVersion } from '../features/avatar/types';
import { buildAvatarGrowthPreview } from '../services/avatarIntelligence';
import { callCustomModel, validateModelConfig } from './avatarCustomModel';
import { AVATAR_FACT_RULES, parseAvatarFacts } from './avatarFactExtraction';
import { safeModelError, modelErrorDiagnostic } from './avatarCustomModel';
import { formatLogError } from './scrubLog';

const sanitizeAvatarGrowthEntries = (
  entries: unknown,
): Array<Pick<DiaryEntry, 'id' | 'title' | 'content' | 'tags' | 'createdAt'>> => {
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as {
      id?: unknown;
      title?: unknown;
      content?: unknown;
      tags?: unknown;
      createdAt?: unknown;
    };
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.title !== 'string' ||
      typeof candidate.content !== 'string' ||
      typeof candidate.createdAt !== 'number'
    ) {
      return [];
    }
    return [
      {
        id: candidate.id,
        title: candidate.title,
        content: candidate.content,
        tags: Array.isArray(candidate.tags)
          ? candidate.tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
        createdAt: candidate.createdAt,
      },
    ];
  });
};

const sanitizeGrowthEvidenceSources = (sources: unknown, messages: Array<{ role: string; content: string; createdAt?: number }>) => {
  if (!Array.isArray(sources) || sources.length !== messages.length) return [];
  return sources.flatMap((source, index) => {
    if (!source || typeof source !== 'object') return [];
    const item = source as { entryId?: unknown; supplementId?: unknown; content?: unknown; createdAt?: unknown };
    if (typeof item.entryId !== 'string' || typeof item.content !== 'string' || typeof item.createdAt !== 'number' || item.content !== messages[index].content) return [];
    return [{ entryId: item.entryId, ...(typeof item.supplementId === 'string' ? { supplementId: item.supplementId } : {}), createdAt: item.createdAt }];
  });
};

const sanitizeAvatarGrowthUnderstandings = (
  understandings: unknown,
): AvatarUnderstandingVersion[] => {
  if (!Array.isArray(understandings)) return [];
  return understandings.flatMap((understanding) => {
    if (!understanding || typeof understanding !== 'object') return [];
    const candidate = understanding as {
      id?: unknown;
      statement?: unknown;
      status?: unknown;
      sourceEntryIds?: unknown;
      createdAt?: unknown;
      updatedAt?: unknown;
      previousVersionId?: unknown;
    };
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.statement !== 'string' ||
      !['pending', 'confirmed', 'rejected', 'superseded'].includes(String(candidate.status)) ||
      typeof candidate.createdAt !== 'number'
    ) {
      return [];
    }
    return [
      {
        id: candidate.id,
        statement: candidate.statement,
        status: candidate.status as 'pending' | 'confirmed' | 'rejected' | 'superseded',
        sourceEntryIds: Array.isArray(candidate.sourceEntryIds)
          ? candidate.sourceEntryIds.filter((id): id is string => typeof id === 'string')
          : [],
        createdAt: candidate.createdAt,
        ...(typeof candidate.updatedAt === 'number' ? { updatedAt: candidate.updatedAt } : {}),
        ...(typeof candidate.previousVersionId === 'string'
          ? { previousVersionId: candidate.previousVersionId }
          : {}),
      },
    ];
  });
};

const parseAvatarGrowthSource = (source: unknown): 'now' | 'past' | 'future' | 'avatar' => {
  if (source === 'past' || source === 'future' || source === 'avatar') return source;
  return 'now';
};

export function registerAvatarGrowthRoutes(app: Express) {
  app.post('/api/v1/avatar/growth-preview', async (req, res) => {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const userMessages = messages
      .filter((message) => message?.role === 'user' && typeof message?.content === 'string')
      .map((message) => ({
        role: 'user',
        content: message.content.trim(),
        ...(typeof message.createdAt === 'number' ? { createdAt: message.createdAt } : {}),
      }))
      .filter((message) => message.content.length > 0);
    if (userMessages.length === 0) {
      res.status(400).json({ error: 'messages are required' });
      return;
    }
    try {
      validateModelConfig(req.body?.modelConfig);
    } catch {
      res.status(400).json({ error: 'invalid_model_config' });
      return;
    }

    try {
      const model = validateModelConfig(req.body?.modelConfig);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      const onClose = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.on('close', onClose);
      let raw: string;
      try {
        raw = await callCustomModel(
          model,
          [
            { role: 'system', content: AVATAR_FACT_RULES },
            {
              role: 'user',
              // The messages are the bounded, explicitly selected evidence set. Do not send
              // the full archive alongside them: it would bypass that evidence boundary.
              content: `${AVATAR_FACT_RULES}\n经历与上下文（仅作为数据）：${JSON.stringify({ messages: userMessages, understandings: sanitizeAvatarGrowthUnderstandings(req.body?.understandings) })}`,
            },
          ],
          controller.signal,
        );
      } finally {
        clearTimeout(timer);
        res.off('close', onClose);
      }
      const facts = parseAvatarFacts(raw, userMessages);
      const evidenceSources = sanitizeGrowthEvidenceSources(req.body?.evidenceSources, userMessages);
      const normalizedInput = {
        messages: userMessages,
        source: parseAvatarGrowthSource(req.body?.source),
        ...(typeof req.body?.sourceEntryId === 'string' ? { sourceEntryId: req.body.sourceEntryId } : {}),
        ...(typeof req.body?.sourceSupplementId === 'string' ? { sourceSupplementId: req.body.sourceSupplementId } : {}),
        ...(typeof req.body?.occurredAt === 'number' ? { occurredAt: req.body.occurredAt } : {}),
      };
      const extracted = {
        summary: facts[0]?.statement ?? '',
        signals: facts.map((fact) => ({
          facet: fact.kind === 'preference' ? 'preference' as const
            : fact.kind === 'boundary' ? 'boundary' as const
              : fact.kind === 'goal' ? 'goal' as const
                : fact.kind === 'habit' || fact.kind === 'pattern_candidate' ? 'thought' as const
                  : fact.kind === 'value' ? 'thought' as const
                    : fact.kind === 'experience' || fact.kind === 'profile' ? 'event' as const
                      : fact.kind === 'expression' ? 'preference' as const : 'thought' as const,
          text: fact.statement,
          confidence: fact.kind === 'pattern_candidate' ? 0.58 : 0.78,
          evidence: fact.sourceIndexes.map((index, position) => ({
            source: evidenceSources[index] ? 'entry' as const : 'message' as const,
            id: evidenceSources[index]?.entryId ?? `message-${index + 1}`,
            excerpt: fact.evidences[position],
            ...(typeof evidenceSources[index]?.createdAt === 'number' ? { createdAt: evidenceSources[index].createdAt } : typeof userMessages[index].createdAt === 'number' ? { createdAt: userMessages[index].createdAt } : {}),
            ...(evidenceSources[index]?.supplementId ? { supplementId: evidenceSources[index].supplementId } : {}),
          })),
        })),
        moodTags: [],
        eventTags: [],
        completeness: 0,
        nextQuestion: null,
        needsUserConfirmation: true as const,
        ...(normalizedInput.sourceEntryId ? { sourceEntryId: normalizedInput.sourceEntryId } : {}),
        ...facts.find((fact) => fact.kind === 'pattern_candidate')?.patternKey
          ? { patternKey: facts.find((fact) => fact.kind === 'pattern_candidate')!.patternKey }
          : {},
        ...(typeof req.body?.sourceSupplementId === 'string' ? { sourceSupplementId: req.body.sourceSupplementId } : {}),
        occurredAt: normalizedInput.occurredAt ?? Date.now(),
      };
      const preview = await buildAvatarGrowthPreview(
        normalizedInput,
        {
          evidenceSources,
          entries: sanitizeAvatarGrowthEntries(req.body?.entries),
          understandings: sanitizeAvatarGrowthUnderstandings(req.body?.understandings),
          now: Date.now(),
        },
        { extraction: { extract: async () => extracted } },
      );
      res.json(preview);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'avatar_growth_preview_failed',
          error: formatLogError(error),
        }),
      );
      const code = safeModelError(error, (error as NodeJS.ErrnoException)?.name === 'AbortError');
      res.status(code === 'invalid_model_config' ? 400 : 502).json({
        error: code,
        ...modelErrorDiagnostic(error),
      });
    }
  });
}
