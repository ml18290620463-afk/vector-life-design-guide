import type { Express } from 'express';
import type { DiaryEntry } from '../types';
import type { AvatarUnderstandingVersion } from '../features/avatar/types';
import { buildAvatarGrowthPreview } from '../services/avatarIntelligence';
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
      const preview = await buildAvatarGrowthPreview(
        {
          messages: userMessages,
          source: parseAvatarGrowthSource(req.body?.source),
          ...(typeof req.body?.sourceEntryId === 'string'
            ? { sourceEntryId: req.body.sourceEntryId }
            : {}),
          ...(typeof req.body?.occurredAt === 'number' ? { occurredAt: req.body.occurredAt } : {}),
        },
        {
          entries: sanitizeAvatarGrowthEntries(req.body?.entries),
          understandings: sanitizeAvatarGrowthUnderstandings(req.body?.understandings),
          now: Date.now(),
        },
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
      res.status(500).json({ error: 'Failed to build avatar growth preview' });
    }
  });
}
