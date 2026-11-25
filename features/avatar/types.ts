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

export type AvatarMemoryNature = 'experience' | 'explicit' | 'inferred' | 'commitment' | 'state';

export type AvatarMemoryCategory =
  | 'profile'
  | 'experience'
  | 'judgment'
  | 'habits'
  | 'goals'
  | 'recent_state'
  | 'relationship'
  | 'expression';

export type AvatarMemoryFacet =
  | 'domain_background'
  | 'preference'
  | 'aversion'
  | 'habit'
  | 'cognitive_pattern'
  | 'behavioral_pattern'
  | 'emotional_pattern'
  | 'relational_pattern'
  | 'value'
  | 'boundary'
  | 'motivation'
  | 'relationship_view'
  | 'emotional_trigger'
  | 'recovery_resource'
  | 'skill'
  | 'constraint'
  | 'aspirational_self';

export type AvatarMemorySensitivity = 'normal' | 'sensitive' | 'private';
export type AvatarMemorySourceKind =
  | 'entry'
  | 'message'
  | 'future'
  | 'principle'
  | 'pattern'
  | 'action'
  | 'practice';

export interface AvatarMemorySourceRef {
  supplementId?: string;
  source: AvatarMemorySourceKind;
  id: string;
  excerpt?: string;
  createdAt?: number;
  /** Identifies the independent chat in which this message was expressed. */
  sessionId?: string;
}

/** Ephemeral output of the existing extraction protocol, never a persisted model. */
export interface AvatarExtractionCandidate {
  id: string;
  statement: string;
  nature: AvatarMemoryNature;
  category?: AvatarMemoryCategory;
  facets: AvatarMemoryFacet[];
  tags: string[];
  contexts: string[];
  sourceRefs: AvatarMemorySourceRef[];
  confidence: number;
  status: 'candidate';
  sensitivity: AvatarMemorySensitivity;
  validFrom?: number;
  createdAt: number;
}

/** Request-only projection for the existing growth endpoint. */
export interface AvatarGrowthCognitionReference {
  id: string;
  statement: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'superseded';
  sourceEntryIds: string[];
  createdAt: number;
  aiVisibility?: 'private' | 'allowed';
}

export const DEFAULT_AVATAR_CONTEXT: AvatarLaunchContext = {
  mode: 'general',
  source: 'global',
};

// Canonical v2 runtime contracts.
export const ONTOLOGY_SCHEMA_VERSION = 2 as const;

export type CognitiveDomain = 'about_me' | 'my_understanding';

export type AboutMeCategory =
  | 'foundation_situation'
  | 'values_motivation'
  | 'preferences_boundaries'
  | 'capabilities_conditions';

export type MyUnderstandingCategory =
  | 'understanding_judgment'
  | 'choices_tradeoffs'
  | 'actions_relationships';

export type CognitiveCategory = AboutMeCategory | MyUnderstandingCategory;

export type CognitiveStatus =
  | 'candidate' // 待确认收件箱中的候选（确认前绝不进入模型记忆上下文）
  | 'confirmed' // 已确认生效
  | 'superseded' // 已被新版本替代（退出活跃池，呈现在「我的变化」）
  | 'rejected' // 用户拒绝
  | 'retained_after_source_delete' // 原记录删除后由用户明确选择留存（可追溯性降级）
  | 'archived_expired'; // staged 阶段状态到期自动沉降为历史轨迹

export interface TemporalValidity {
  mode: 'long_term' | 'staged';
  validFrom: string; // ISO 8601
  validUntil?: string | null; // mode === 'staged' 时必填；过期由沉降逻辑转为 archived_expired
  lastVerifiedAt?: string | null; // 最近一次确认或新增证据印证的时间
}

export interface EvidenceGateState {
  requiresMultiSourceGate: boolean; // about_me = false; my_understanding 推断型 = true
  independentExperienceCount: number;
  distinctUserMessageCount: number;
  distinctDateCount: number;
  distinctSessionCount: number;
  /** 规则: (!requiresMultiSourceGate) || ((independentExperienceCount >= 2 || distinctUserMessageCount >= 3) && (distinctDateCount >= 2 || distinctSessionCount >= 2)) */
  isReadyForConfirmation: boolean;
}

export interface PersonalGuardrail {
  enabled: boolean;
  triggerTags: string[]; // 绑定的横向记录标签
  conditionSummary: string; // IF 触发条件简述
  reminderDirective: string; // THEN 决策/复盘时注入的张力提醒指令
}

export interface CognitivePrivacy {
  sensitivity: 'normal' | 'sensitive' | 'high';
  aiVisible: boolean;
  traceabilityDegraded: boolean; // 仅在 retained_after_source_delete 时为 true
}

export interface CognitiveObject {
  id: string;
  schemaVersion: typeof ONTOLOGY_SCHEMA_VERSION;
  domain: CognitiveDomain;
  category: CognitiveCategory;
  /** 高密度表达：优先采用“场景条件 + 稳定结论”句式 */
  statement: string;
  notes?: string;
  status: CognitiveStatus;
  validity: TemporalValidity;
  privacy: CognitivePrivacy;
  evidenceGate: EvidenceGateState;
  guardrail?: PersonalGuardrail;
  confidenceScore: number; // 0 ~ 1，仅作本地排序权重
  reinforcementCount: number; // 增量融合命中次数
  version: number; // 初始 1，每次 SUPERSEDES 递增
  lineageId: string; // 同一演进谱系共享 ID
  origin: 'extracted_from_chat' | 'distilled_from_record' | 'user_manual';
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string | null;
  migration?: CognitiveMigrationMetadata;
  /** Review-only proposal. It has no effect until the user explicitly confirms it. */
  pendingRevision?: { previousObjectId: string; reason: string };
}

export type OntologyEdgeType = 'EVIDENCED_BY' | 'SCOPED_IN' | 'TENSION_WITH' | 'SUPERSEDES';

export interface OntologyEdgeBase {
  id: string;
  schemaVersion: typeof ONTOLOGY_SCHEMA_VERSION;
  type: OntologyEdgeType;
  fromId: string;
  toId: string;
  createdAt: string;
}

export interface EvidencedByEdge extends OntologyEdgeBase {
  type: 'EVIDENCED_BY';
  sourceKind: 'now_entry' | 'past_experience' | 'action_review' | 'chat_user_message';
  sessionId?: string;
  userMessageIndex?: number; // sourceKind === 'chat_user_message' 时必填且必须为 user 消息
  verbatimQuote: string; // 经服务端校验存在于原文中的片段
  quoteVerifiedByServer: boolean;
  sourceOccurredAt: string; // Event Time，用于跨日期门槛判断
  /** 仅用于 UI 提示，不可替代运行时实时权限重核 */
  lastKnownSourceState: 'accessible' | 'restricted_or_revoked' | 'deleted';
}

export interface ScopedInEdge extends OntologyEdgeBase {
  type: 'SCOPED_IN';
  tagLabel: string; // 记录侧标签名称，如 "#工作"
  bindingSource: 'inherited_from_evidence' | 'user_assigned';
  evidenceWeight: number; // 该标签下的支撑证据数量
}

export interface TensionWithEdge extends OntologyEdgeBase {
  type: 'TENSION_WITH';
  targetKind: 'cognitive_object' | 'future_goal' | 'action_item';
  tensionSummary: string;
  status: 'active' | 'resolved' | 'dismissed';
}

export interface SupersedesEdge extends OntologyEdgeBase {
  type: 'SUPERSEDES';
  revisionReason?: string;
  triggerRecordId?: string;
  confirmedByUserAt: string;
}

export type OntologyEdge = EvidencedByEdge | ScopedInEdge | TensionWithEdge | SupersedesEdge;

/** Historical confirmation is not v2 confirmation. Only migration populates this field. */
export interface CognitiveMigrationMetadata {
  legacyIds: string[];
  legacyStatus: string;
  legacyConfirmedAt?: string;
  diagnostics: string[];
}

/** 「我的变化」实时投影视图（禁止单独建表冗余存储） */
export interface RevisionTrajectoryItem {
  edgeId: string;
  lineageId: string;
  category: CognitiveCategory;
  previousObject: Pick<CognitiveObject, 'id' | 'statement' | 'confirmedAt' | 'version'>;
  currentObject: Pick<CognitiveObject, 'id' | 'statement' | 'confirmedAt' | 'version'>;
  relatedTags: string[];
  revisionReason?: string;
  triggerRecordId?: string;
  confirmedAt: string;
  disclaimerType: 'revision_not_proven_growth';
}

// Contracts for subsequent phases; no retrieval or extraction behavior is activated here.
/** 底层保留 6 种任务协议以复用现有上下文与提示词能力 */
export type AvatarTaskMode = 'capture' | 'distill' | 'recall' | 'decide' | 'review' | 'general';

/** 前台收敛为 3 大自然意图入口 */
export type AvatarUserIntent =
  | 'quick_capture' // 帮我记一笔 -> 路由至 capture / 轻度 distill
  | 'ask_self' // 问问我自己 -> 路由至 本地确定性检索 / recall / general
  | 'decide_review'; // 帮我拿主意与复盘 -> 路由至 decide / review / growth preview

export interface SlotQuotas {
  aboutMe: number;
  myUnderstandingAndChanges: number;
  rawRecordsAndFuture: number;
}

export interface GuidanceQuotaPolicy {
  mode: AvatarTaskMode;
  defaultLimit: number;
  expandedLimit: number;
  maxExcerptChars: 700;
  maxConversationMessages: 120;
  slotQuotas: SlotQuotas;
  allowEmptySlotOverflow: boolean;
  minRelevanceScore: number;
}

export interface GuidanceRetrievalManifest {
  mode: AvatarTaskMode;
  scopeTier: 'default' | 'expanded' | 'local_deterministic';
  appliedLimit: number;
  matchedCount: number;
  filteredOutByPrivacyCount: number;
  filteredOutByExpiryCount: number;
  excludedByUserCount: number; // 发送前由用户主动剔除的条数
  searchedTags: string[];
  searchedTimeRange?: { from: string; to: string };
  breakdown: {
    aboutMeCount: number;
    understandingCount: number;
    rawRecordCount: number;
  };
  triggeredGuardrailIds: string[];
  canExpandScope: boolean;
}

/** 统一对话产物确认卡片（收口原 4 条割裂审核链） */
export type ArtifactCardKind =
  | 'now_record_draft' // 原 capture 记录预览
  | 'cognitive_candidate' // 新建认知对象（关于我 / 我的认识）
  | 'cognitive_reinforcement' // 向已有认知追加新证据
  | 'cognitive_revision' // 修订已有认识（确认后写入 SUPERSEDES）
  | 'future_growth_draft'; // 原 growth preview 未来微行动/方向草稿

export interface UnifiedArtifactCard {
  id: string;
  kind: ArtifactCardKind;
  title: string;
  summary: string;
  status: 'draft' | 'confirmed' | 'dismissed';
  evidenceAnchors: Array<{
    sourceKind: EvidencedByEdge['sourceKind'];
    sourceId: string;
    quote: string;
    occurredAt: string;
    accessible: boolean;
  }>;
  tags: string[];
  aiVisibleToggleable: boolean;
  aiVisible: boolean;
  payload: unknown; // 按 kind 做判别联合类型校验
}

export type ExtractionAction =
  | 'create_new' // 新建 CognitiveObject 候选
  | 'reinforce_existing' // 与现有对象高度同义：仅追加 EVIDENCED_BY / 更新 SCOPED_IN 权重
  | 'propose_supersede'; // 与现有对象观点冲突：生成修订候选（关联 targetObjectId）

export interface ExtractedCandidateV2 {
  action: ExtractionAction;
  targetObjectId?: string; // reinforce_existing / propose_supersede 必填
  domain: CognitiveDomain;
  category: CognitiveCategory;
  statement: string;
  validityMode: 'long_term' | 'staged';
  suggestedValidDays?: number; // staged 时推荐 14 / 30 / 90
  inheritedTags: string[];
  userMessageIndex: number; // 服务端强制校验指向 user 消息
  verbatimQuote: string; // 服务端强制校验精确子串存在
  revisionReason?: string; // propose_supersede 时必填
}

export interface FactExtractionResponseV2 {
  /** 严格上限 3 条 */
  candidates: ExtractedCandidateV2[];
  droppedReasons?: Array<{
    index: number;
    reason: 'invalid_role' | 'quote_mismatch' | 'forbidden_event_or_commitment';
  }>;
}
