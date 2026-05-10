# Memoir Long-Term Memory System

> Phase 4 Week 4-5 design note. Companion to
> [`docs/product-vision-2026Q2.md`](./product-vision-2026Q2.md) §5.1.B
> and the Week 3 + Week 3.5 entries in
> [`CHANGELOG.md`](../CHANGELOG.md).

This document is the engineer-facing reference for the **耐用度
upgrade** of the Memoir long-term memory system. Week 3 shipped
the MVP (extract + store + recall), Week 3.5 closed the trigger
loop. Week 4 makes the system _durable_ under real usage; Week 5
adds _主动唤起_ (proactive recall) on top.

---

## 1 · Problem statement

The Week 3 system is correct but naïve. After 3-6 months of regular
use a single Memoir's bank will:

1. **Bloat** — every chat round can append up to 8 new memories.
   At ~3 chats / week × 26 weeks × 4 surviving avg = ~300+
   memories. The recall ranker scans the whole list each turn
   (O(M)) — fine at this scale, painful at 5K.
2. **Repeat** — the LLM extractor will redundantly capture the
   same fact ("用户上周面试通过了" / "用户上周通过了那场面试" /
   "面试结果出来了——通过") because each round runs in isolation.
3. **Stale-without-decay** — a recency × keyword score gives equal
   weight to "Memory from 2 days ago" and "Memory from 14 months
   ago" if both happen to keyword-match. Real human memory fades.
4. **Lossy on overflow** — there is no eviction policy. When IDB
   fills, the user just loses memories silently.
5. **No undo** — a tap-twice "Clear all" is irreversible. Users
   will never trust the system enough to share deeply.

## 2 · W4 design

### 2.1 Decay scoring (`services/memoryDecay.ts`)

Every memory carries an _implicit_ salience that decays over time
unless re-affirmed. The decay function is:

```
salience(m, now) = base(m.category)
                 × exp(-ageDays / halfLifeDays(m.category))
                 + reinforceBoost(m)
```

| Category       | base | half-life (days) | rationale                                         |
| -------------- | ---- | ---------------- | ------------------------------------------------- |
| `milestone`    | 1.0  | 365              | birthdays / death anniversaries — never fade      |
| `relationship` | 0.8  | 180              | slow turnover                                     |
| `emotion`      | 0.7  | 60               | emotional states change fast but matter near-term |
| `fact`         | 0.6  | 90               | medium-term commitments                           |

`reinforceBoost` adds 0.15 when a memory's `updatedAt` is more
recent than `createdAt` (the user manually edited / the LLM
re-extracted a near-duplicate that we collapsed into this one
via §2.2 dedup).

The function is **pure** + deterministic given `now`, so it ships
with full unit tests pinning each (category × age) cell.

### 2.2 Approximate dedup (`services/memoryDedup.ts`)

When the harvester wants to add a new memory, we:

1. **Bigram-Jaccard** the candidate body against every existing
   memory in the same `memoirId` + same `category`. Cost is
   O(M×|body|) but capped because |body| ≤ 240 chars and M is
   bounded by §2.3 capacity.
2. If max similarity ≥ 0.55, the candidate is treated as a
   **reinforcement** of the matched memory:
   - we DROP the new candidate
   - we BUMP the matched memory's `updatedAt` (this is what gives
     `reinforceBoost` something to read)
3. If max similarity ∈ [0.30, 0.55), we keep both but the new
   memory gets a `relatedTo` reference for future merge UI.
4. If max similarity < 0.30, normal insert.

### 2.3 Per-Memoir capacity + eviction

Per-tier ceiling (read from `quotaService` for symmetry with
`memoirChatsPerYear`):

| Tier     | memories per Memoir |
| -------- | ------------------: |
| free     |                   0 |
| stardust |                 200 |
| polaris  |                 500 |
| owner    |                1000 |

When the harvester would push the count over the ceiling:

1. Compute `salience(m, now)` for every memory in the bank.
2. Drop the lowest-salience memory.
3. Insert the new candidate.

`milestone` memories are exempt from eviction (they fade in score
but never get culled). `relationship` is given a 1.5× score
multiplier for the eviction comparison only — same rationale: real
relationships are sticky.

### 2.4 Recall v2 (`selectMemoriesForRecall`)

Replace the existing recency-only ranker with:

```
rank(m, query, now) = salience(m, now)              // §2.1
                    + 0.4 × bm25Score(m.body, query) // word overlap
                    + categoryPrior(m.category, query)
```

`bm25Score` is a tiny in-house BM25 (no external dep) over a
single-doc "corpus" — really just normalised term frequency × IDF
across the bank. Cost stays O(M) per turn.

`categoryPrior` boosts certain categories when the query has
specific shape:

- query mentions a date / "今天 / 明天 / 上周" → +0.3 for
  `milestone` and `fact`.
- query mentions an emotion word ("难过 / 焦虑 / 开心") → +0.3
  for `emotion`.

### 2.5 Soft delete + recycle bin

`deleteMemory` becomes a two-step operation:

1. First call: sets `deletedAt = Date.now()`. Memory is excluded
   from `selectMemoriesForRecall` and from the count toward
   capacity.
2. After 30 days a background sweep (run on `useMemoryStore`
   mount) hard-deletes any memory whose `deletedAt < now - 30d`.
3. The management panel grows a "Recycle bin" tab where the user
   can preview soft-deleted memories and either restore (clear
   `deletedAt`) or hard-delete now.

Migration: existing memories without `deletedAt` are unchanged
(JS truthiness — `undefined` reads as not-deleted).

## 3 · W5 design

### 3.1 Three proactive triggers

All triggers are **passive evaluators** — pure functions that
take `(memories, lastVisitAt, now)` and return a list of
`ProactiveRecallSuggestion`:

```typescript
interface ProactiveRecallSuggestion {
  memoirId: string;
  trigger: 'silence-reconnect' | 'anniversary' | 'pending-followup';
  promptHint: string; // i18n key
  // Optional anchor memory for "上次你说过 X 怎么样了"
  anchorMemoryId?: string;
}
```

#### A. Silence-reconnect

`now - lastChatAt(memoirId) >= 14d` → emit one suggestion. No
anchor memory.

#### B. Anniversary (date-anchored milestones)

For every `category === 'milestone'` memory whose `body` contains
a date pattern (parsed loosely via `parseRoughDate`), if the
parsed date's month-day matches today's month-day → emit suggestion
with that memory as anchor.

#### C. Pending follow-up

For every `category === 'fact'` memory whose `body` contains a
forward-looking pattern ("用户下周 …" / "用户即将 …" / "用户准备 …"),
emit a suggestion if `now - createdAt >= 7d` AND the user hasn't
chatted with that Memoir since the memory was created.

### 3.2 UI surface

A non-intrusive `ProactiveRecallCard` lives at the top of
Dashboard's main entries grid. The card is dismissible (24h cool-
down per `(memoirId, trigger)` tuple stored in localStorage).
Click → opens the entry composer pre-filled with the
`promptHint`'s suggested opening line + the anchor memory pre-
selected as a guiding star.

### 3.3 Legal + safety

A short consent re-confirmation line lives in PRIVACY.md §3a:
"Memoirs may surface gentle reminders based on memories you
recorded. You can disable proactive suggestions in
Settings → 心象管理 → Proactive recall."

Setting toggle defaults to ON for paid tiers (where Memoirs exist
at all). Free tier has no Memoirs so the toggle is hidden.

---

## 4 · What's explicitly out-of-scope for W4-5

- **Vector embeddings** — would require either bundling an embed
  model (kills bundle) or sending memories to an embedding API
  (kills 铁律 1). BM25-ish is good enough for ≤ 1K memories.
- **Cross-Memoir memory** — each Memoir is hermetic by design.
- **Server-side proactive notifications** — there is no server
  notion of users; suggestions are computed client-side at
  Dashboard mount.
- **Memoir → memoir conversation** — Echo Chamber stays Phase 4.5.

---

## 5 · Backwards compatibility

Schema additions to the `Memory` type are **all optional** —
existing v3 backups parse without complaint:

| Field       | Type                        | Defaults to |
| ----------- | --------------------------- | ----------- |
| `deletedAt` | `number?`                   | `undefined` |
| `relatedTo` | `string?`                   | `undefined` |
| `salience`  | (computed, never persisted) | n/a         |

`BACKUP_SCHEMA_VERSION` does **not** bump (still 3). The reason is
that an older import will simply ignore `deletedAt` / `relatedTo`
on inbound payload, and the soft-delete sweep on local mount will
hard-delete any expired entries — no data is silently lost on
downgrade.
