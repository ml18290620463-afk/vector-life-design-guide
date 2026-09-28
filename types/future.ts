import type { AvatarMemorySourceRef } from '../features/avatar/types';
import type { ActionItem, ActionItemStatus, DiaryEntry } from './models';

export type DateOnly = string;
export type Measurement =
  | { kind: 'narrative' }
  | { kind: 'quantity'; target: number; unit: string; precision: number; distinctItems: boolean };
export interface Vision {
  id: string;
  text: string;
  status: 'active' | 'paused' | 'archived';
  revision: number;
  createdAt: number;
  updatedAt: number;
}
export interface Goal {
  id: string;
  title: string;
  visionId?: string;
  measurement: Measurement;
  status: 'active' | 'paused' | 'completed' | 'ended';
  startDate?: DateOnly;
  dueDate?: DateOnly;
  tags: string[];
  revision: number;
  createdAt: number;
  updatedAt: number;
}
export type ProgressValue =
  | { kind: 'quantity'; amount: number; itemId?: string }
  | { kind: 'narrative'; note: string };
export type ActionFeedbackStatus = 'completed' | 'partial' | 'not_completed' | 'cancelled';
export type ActionFeedbackNextStep = 'continue' | 'adjust' | 'pause' | 'end';
export interface ActionFeedback {
  status: ActionFeedbackStatus;
  note: string;
  nextStep: ActionFeedbackNextStep;
}
/**
 * Ephemeral context carried from a finished action into the past module.
 * It is deliberately not persisted as a principle or a memory: people decide
 * for themselves whether an action is worth turning into a lasting reminder.
 */
export interface PracticeReflectionContext {
  actionTitle: string;
  result: string;
  nextStep: ActionFeedbackNextStep;
}
/** A user-authored record of carrying out an action. It deliberately does not
 * require a goal: actions can be useful preparations in their own right. */
export interface ActionPracticeRecord {
  id: string;
  actionId: string;
  status: ActionFeedbackStatus;
  note: string;
  nextStep: ActionFeedbackNextStep;
  occurredOn: DateOnly;
  createdAt: number;
}
export interface ProgressEvent {
  id: string;
  goalId: string;
  operationId: string;
  semanticKey: string;
  value: ProgressValue;
  occurredOn: DateOnly;
  sourceEntryId?: string;
  sourceActionId?: string;
  sourceState: 'linked' | 'standalone' | 'source-deleted';
  confirmedBy: 'user';
  status: 'valid' | 'revoked';
  replacesEventId?: string;
  goalRevision: number;
  createdAt: number;
  revokedAt?: number;
  actionFeedback?: ActionFeedback;
}
export interface GoalItem {
  id: string;
  goalId: string;
  label: string;
}
export interface GoalRevision {
  id: string;
  before: Goal;
  after: Goal;
  createdAt: number;
}
export interface GoalClosure {
  id: string;
  goalId: string;
  snapshot: Goal;
  progressEventIds: string[];
  total: number | null;
  createdAt: number;
}
export interface FutureState {
  /** Explicit, user-confirmed promotion of a memory; never inferred from similar text. */
  archiveOrigins?: Record<string, { kind: 'vision' | 'goal' | 'action'; id: string; sourceRefs: AvatarMemorySourceRef[]; fingerprint?: string }>;
  schemaVersion: 1;
  revision: number;
  visions: Vision[];
  goals: Goal[];
  items: GoalItem[];
  events: ProgressEvent[];
  practiceRecords?: ActionPracticeRecord[];
  revisions: GoalRevision[];
  closures: GoalClosure[];
  receipts: { operationId: string; digest: string; eventIds: string[]; revision: number }[];
}
export interface OutcomeTarget {
  goalId: string;
  expectedRevision: number;
  value: ProgressValue;
  itemLabel?: string;
  replacesEventId?: string;
  actionFeedback?: ActionFeedback;
}
export interface OutcomeInput extends OutcomeTarget {
  operationId: string;
  /** Explicit per-goal contributions, committed together with the primary target. */
  additionalTargets?: OutcomeTarget[];
  occurredOn: DateOnly;
  sourceEntryId?: string;
  entry?: DiaryEntry;
  actionId?: string;
  expectedActionRevision?: number;
  actionStatus?: ActionItemStatus;
}
export interface ActionPracticeInput {
  actionId: string;
  expectedActionRevision: number;
  status: ActionFeedbackStatus;
  note: string;
  nextStep: ActionFeedbackNextStep;
  occurredOn: DateOnly;
}
export interface FutureSnapshot {
  state: FutureState;
  actions: ActionItem[];
  protectedVault: boolean;
}
