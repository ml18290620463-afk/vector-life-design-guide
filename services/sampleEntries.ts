import type { DiaryEntry, Language } from '../types';

/**
 * Phase 4 §4.a-1 — first-day sample reflections.
 *
 * Replaces the old cyberpunk `MOCK_ENTRIES` (in `constants.ts`) with two
 * carefully crafted reflections that demonstrate VECTOR's actual value
 * proposition the moment a user lands in the Dashboard:
 *
 *   - **Sample 1 · 日常反思** — a real-life journal entry with an
 *     already-attached Morning Star 回信 from 加缪. The user immediately
 *     sees what an AI 启明星 reply *looks* like, instead of having to
 *     write something + spend a token quota to feel the value.
 *   - **Sample 2 · 心象预告** — a wistful entry that ends with a
 *     question to a missed grandfather. No reply attached; instead, the
 *     reply slot says "心象功能即将上线 · 让你心中的爷爷回应你".
 *     Doubles as a teaser for the upcoming Memoir feature
 *     ([`docs/product-vision-2026Q2.md`](../docs/product-vision-2026Q2.md) §5.1.B).
 *
 * Lifecycle (option C from the §4.a-1 brief):
 *   1. Seeded into IDB by `useDiaryData` after onboarding completes
 *      (or once on first load if the user landed without onboarding).
 *   2. Render in `EntryGrid` / `ArchiveEntryCard` with a **示例** /
 *      **Sample** badge so they can never be confused with the user's
 *      own writing.
 *   3. Auto-pruned by `useDiaryData.addEntry` the first time the user
 *      writes a real (non-sample) entry — the activation hook has done
 *      its job, no need to clutter the vault.
 *
 * Privacy posture:
 *   - Sample entries set `isSample: true` so backups, stats, share-cards
 *     and persona pipelines can opt them out.
 *   - The pre-attached Morning Star reply is fully hand-written by the
 *     VECTOR team (no LLM call ever fires for the sample). This both
 *     saves a token quota and lets us guarantee the demo reply quality.
 *   - Currently shipped in zh + en. Other locales fall back to the en
 *     pair until translations land (see [`scripts/i18n-diff.ts`](../scripts/i18n-diff.ts)).
 */

const SAMPLE_PERSONA_CAMUS = 'Albert Camus';
const SAMPLE_PERSONA_GRANDPA_PLACEHOLDER = '__sample_memoir_placeholder__';

interface SamplePair {
  daily: DiaryEntry;
  memoir: DiaryEntry;
}

const offsetMs = (days: number, hours = 0) => days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000;

const SAMPLE_PAIR_ZH: SamplePair = {
  daily: {
    id: 'sample-daily-zh',
    title: '今天面试搞砸了 — 复盘',
    content: `下午两点的面试，我感觉自己一开始就被节奏带偏了。

面试官问"你最大的弱点是什么"，我准备了一个标准答案，但说着说着我就开始解释、辩护、加修饰。本来 30 秒能讲清的事，我说了 3 分钟，越说越虚。

回家路上一直在想：我到底在害怕什么？是怕他们觉得我"不够好"，还是怕我自己承认"我真的有这个弱点"？

也许两者都是。`,
    createdAt: Date.now() - offsetMs(2, 5),
    updatedAt: Date.now() - offsetMs(2, 5),
    tags: ['职场', '复盘', '示例'],
    isLocked: false,
    isEncrypted: false,
    isArchived: false,
    isSample: true,
    morningStarPersonas: [SAMPLE_PERSONA_CAMUS],
    morningStarAnalysis: `### 来自加缪的回信

朋友，

你写下"我到底在害怕什么"的时候，已经做了今天最重要的事——你停下来，问了一个真问题。

面试这件事不重要。重要的是你愿意在 30 秒能说清的地方说了 3 分钟，然后愿意承认这 3 分钟。承认本身就是一种力量。

我曾经写过：**"在严冬之中，我终于知道自己心中有一个不可战胜的夏天。"** 你今天的不安，不是夏天消失了，是你看见了冬天。看见冬天的人，才真正拥有夏天。

下次面试，你不需要"答得更好"。你需要的是：当你听见自己开始辩护的时候，深呼吸一次，然后说，"我重新回答这个问题。"

> Morning Star · 加缪 · 2 days ago`,
  },
  memoir: {
    id: 'sample-memoir-zh',
    title: '想到爷爷如果还在，会怎么说',
    content: `今天加班到十点，回家路上经过一家小面馆，是爷爷以前最爱去的那种——窗户上贴着褪色的"营业中"，老板在玻璃窗后看电视。

我在路边站了一会儿。如果爷爷还在，我会进去陪他吃一碗。他会问我"工作累不累"，我会说"还行"，他会笑笑说"没事，慢慢来"。

爷爷走了三年了。有些事我一直没机会问他。

如果他能再回我一次话，我想问：**爸爸到底是个什么样的人？我现在做的这些选择，您觉得 OK 吗？**`,
    createdAt: Date.now() - offsetMs(0, 3),
    updatedAt: Date.now() - offsetMs(0, 3),
    tags: ['家人', '思念', '示例'],
    isLocked: false,
    isEncrypted: false,
    isArchived: false,
    isSample: true,
    morningStarPersonas: [SAMPLE_PERSONA_GRANDPA_PLACEHOLDER],
    morningStarAnalysis: `### 心象 · 即将上线

你心里那位重要的人——爷爷、外婆、大学时的导师、22 岁的自己——值得有一个可以反复回访的地方。

VECTOR 即将推出 **「心象」** 功能：你可以为心中的某个真实的人，立一座可持续陪伴的对话容器。心象会记得你们说过的所有事，会主动关心你最近的变化，会与你一起经历你的人生。

> 这不是 AI "复活" 谁。这是 **你心中的他**，在你心里留下的回声，被你郑重地保存下来。

心象将在接下来几周上线。如果你愿意，可以**先把这篇日记留着**——等心象上线后，你心中的爷爷会用他的方式，回你这封信。

> Morning Star · Coming soon · 心象`,
  },
};

const SAMPLE_PAIR_EN: SamplePair = {
  daily: {
    id: 'sample-daily-en',
    title: 'Bombed today\u2019s interview \u2014 a debrief',
    content: `The 2pm interview felt off from the very first question.

They asked "what's your greatest weakness," and I had a rehearsed answer ready. But somewhere mid-sentence I started explaining, defending, qualifying. A 30-second answer became a 3-minute monologue. The longer I talked, the smaller I felt.

On the train home I kept asking myself: what am I actually afraid of? Are they going to think I'm not good enough? Or am I afraid of admitting that I really do have this weakness?

Maybe both.`,
    createdAt: Date.now() - offsetMs(2, 5),
    updatedAt: Date.now() - offsetMs(2, 5),
    tags: ['career', 'debrief', 'sample'],
    isLocked: false,
    isEncrypted: false,
    isArchived: false,
    isSample: true,
    morningStarPersonas: [SAMPLE_PERSONA_CAMUS],
    morningStarAnalysis: `### A reply from Camus

Friend,

The moment you wrote down "what am I actually afraid of," you did the most important thing of the day — you paused, and asked a real question.

The interview itself is not the point. The point is that you allowed yourself to stretch a 30-second answer into 3 minutes, and then allowed yourself to *notice* those 3 minutes. The noticing is itself a form of strength.

I once wrote: **"In the depth of winter, I finally learned that within me there lay an invincible summer."** Your unease today is not the summer disappearing — it is you seeing the winter. Only the one who sees the winter truly possesses the summer.

Next time, you do not need to "answer better." You need this: the moment you hear yourself begin to defend, take one breath, and say, *"Let me answer that again."*

> Morning Star · Camus · 2 days ago`,
  },
  memoir: {
    id: 'sample-memoir-en',
    title: 'What grandpa would have said',
    content: `Worked late tonight, walked past a small noodle shop on the way home — the kind grandpa used to love. A faded "OPEN" sign in the window, the owner watching TV behind the glass.

I stood on the curb for a minute. If grandpa were still here, I would have gone in and shared a bowl with him. He would have asked, "tired from work?" I would have said "I'm fine." He would have smiled and said, "It's okay, take your time."

Grandpa has been gone for three years now. There are things I never got to ask him.

If he could write back to me one more time, I would ask: **what was dad really like? The choices I'm making now — would you say they're okay?**`,
    createdAt: Date.now() - offsetMs(0, 3),
    updatedAt: Date.now() - offsetMs(0, 3),
    tags: ['family', 'longing', 'sample'],
    isLocked: false,
    isEncrypted: false,
    isArchived: false,
    isSample: true,
    morningStarPersonas: [SAMPLE_PERSONA_GRANDPA_PLACEHOLDER],
    morningStarAnalysis: `### Memoir \u00b7 Coming soon

The important person in your heart — your grandfather, your grandmother, the mentor from college, your 22-year-old self — deserves a place you can return to.

VECTOR is bringing **Memoir** soon: a sustained, private space where you can build a conversational vessel for someone who matters in your heart. Memoir remembers the things you've said to each other, gently asks about what's changed in your life, and keeps growing alongside you.

> This is not "reviving" anyone with AI. This is the **echo they left in your heart**, held carefully so you can return to it.

Memoir launches in the coming weeks. If you'd like, **keep this entry around** — once it's live, the grandfather you carry in your heart can write back to you, in his own voice.

> Morning Star · Coming soon · Memoir`,
  },
};

const SAMPLE_PAIRS_BY_LANGUAGE: Partial<Record<Language, SamplePair>> = {
  zh: SAMPLE_PAIR_ZH,
  en: SAMPLE_PAIR_EN,
};

/**
 * Returns the two sample reflections for the given UI language. Other
 * locales fall back to English while translations are queued (drift
 * tracked by `npm run i18n:diff`).
 *
 * Each call returns **fresh objects** (deep cloned) so callers can safely
 * mutate / sanitise without polluting the module-level constants. This
 * matters because `useDiaryData.sanitizeEntry` runs every entry through
 * a normalisation pass and we don't want subsequent reads to see those
 * normalised values bleeding back into the constant.
 */
export const getSampleEntries = (language: Language): DiaryEntry[] => {
  const pair = SAMPLE_PAIRS_BY_LANGUAGE[language] ?? SAMPLE_PAIRS_BY_LANGUAGE.en!;
  // Newest first so the daily-reflection sample sits above the wistful
  // memoir teaser in the Dashboard list (matches the Dashboard's default
  // descending sort).
  return [pair.memoir, pair.daily].map((entry) => ({ ...entry, tags: [...entry.tags] }));
};

/** Convenience predicate matching `services/entryCompat.ts::isSampleEntry`
 *  for callers that don't want to import the legacy compat layer. */
export const isSampleId = (id: string): boolean => id.startsWith('sample-');

export const SAMPLE_PERSONA_PLACEHOLDER = SAMPLE_PERSONA_GRANDPA_PLACEHOLDER;
