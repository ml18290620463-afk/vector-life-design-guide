import type { ChatMessage } from '../now/types/now';

export type AvatarMode = 'capture' | 'distill' | 'recall' | 'decide' | 'review' | 'general';

export type AvatarLaunchSource =
  | 'now'
  | 'past-detail'
  | 'past-search'
  | 'future'
  | 'action-review'
  | 'global';

export interface AvatarLaunchContext {
  mode: AvatarMode;
  source: AvatarLaunchSource;
  entryId?: string;
  query?: string;
  actionId?: string;
  prompt?: string;
}

export interface AvatarSourceReference {
  entryId: string;
  title: string;
  date: number;
  excerpt: string;
  reason: string;
}

export interface AvatarSession {
  id: string;
  mode: AvatarMode;
  context: AvatarLaunchContext;
  messages: ChatMessage[];
  references: AvatarSourceReference[];
  createdAt: number;
  updatedAt: number;
}

export type AvatarUnderstandingStatus = 'pending' | 'confirmed' | 'rejected' | 'superseded';

export interface AvatarUnderstandingVersion {
  id: string;
  statement: string;
  status: AvatarUnderstandingStatus;
  sourceEntryIds: string[];
  createdAt: number;
  updatedAt?: number;
  previousVersionId?: string;
}

export const DEFAULT_AVATAR_CONTEXT: AvatarLaunchContext = {
  mode: 'general',
  source: 'global',
};
