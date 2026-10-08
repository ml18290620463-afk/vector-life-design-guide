import type { DiaryEntry, Language } from '../types';

/**
 * First-day sample reflections.
 *
 * Replaces the old cyberpunk `MOCK_ENTRIES` (in `constants.ts`) with two
 * carefully crafted reflections that demonstrate VECTOR's actual value
 * proposition the moment a user lands in the Dashboard:
 *
 *   - **Sample 1 · 日常复盘** — a real-life journal entry that shows how
 *     a messy experience can be captured without over-polishing.
 *   - **Sample 2 · 家庭记忆** — a quieter memory entry that shows VECTOR
 *     can preserve emotional material as well as practical decisions.
 *
 * Lifecycle (option C from the §4.a-1 brief):
 *   1. Seeded into IDB by `useDiaryData` after onboarding completes
 *      (or once on first load if the user landed without onboarding).
 *   2. Render in Past / `ArchiveEntryCard` surfaces with a **示例** /
 *      **Sample** badge so they can never be confused with the user's
 *      own writing.
 *   3. Auto-pruned by `useDiaryData.addEntry` the first time the user
 *      writes a real (non-sample) entry — the activation hook has done
 *      its job, no need to clutter the vault.
 *
 * Privacy posture:
 *   - Sample entries set `isSample: true` so backups, stats, share-cards
 *     and analysis flows can opt them out.
 *   - Currently shipped in zh + en. Other locales fall back to the en
 *     pair until translations land (see [`scripts/i18n-diff.ts`](../scripts/i18n-diff.ts)).
 */

interface SamplePair {
  daily: DiaryEntry;
  family: DiaryEntry;
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
  },
  family: {
    id: 'sample-family-zh',
    title: '路过那家小面馆，想起爷爷',
    content: `今天加班到十点，回家路上经过一家小面馆，是爷爷以前最爱去的那种——窗户上贴着褪色的"营业中"，老板在玻璃窗后看电视。

我在路边站了一会儿。如果爷爷还在，我会进去陪他吃一碗。他会问我"工作累不累"，我会说"还行"，他会笑笑说"没事，慢慢来"。

爷爷走了三年了。有些事我一直没机会问他。

我今天没有特别大的悲伤，只是突然意识到：有些人不在了，但他们留下的语气、动作和判断标准，还会在生活里陪我们很久。

我想把这件小事记下来。不是为了回答什么问题，只是为了不让它从这一天里滑走。`,
    createdAt: Date.now() - offsetMs(0, 3),
    updatedAt: Date.now() - offsetMs(0, 3),
    tags: ['家人', '思念', '示例'],
    isLocked: false,
    isEncrypted: false,
    isArchived: false,
    isSample: true,
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
  },
  family: {
    id: 'sample-family-en',
    title: 'The noodle shop that reminded me of grandpa',
    content: `Worked late tonight, walked past a small noodle shop on the way home — the kind grandpa used to love. A faded "OPEN" sign in the window, the owner watching TV behind the glass.

I stood on the curb for a minute. If grandpa were still here, I would have gone in and shared a bowl with him. He would have asked, "tired from work?" I would have said "I'm fine." He would have smiled and said, "It's okay, take your time."

Grandpa has been gone for three years now. There are things I never got to ask him.

I did not feel devastated today. It was softer than that. I just noticed that someone can be gone and still leave behind a tone, a gesture, a way of judging whether a day was lived well.

I want to keep this small moment. Not to solve anything. Just so it does not slip out of the day.`,
    createdAt: Date.now() - offsetMs(0, 3),
    updatedAt: Date.now() - offsetMs(0, 3),
    tags: ['family', 'longing', 'sample'],
    isLocked: false,
    isEncrypted: false,
    isArchived: false,
    isSample: true,
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
  // Newest first so the more recent family-memory sample sits above the
  // daily-reflection sample in the Dashboard list.
  return [pair.family, pair.daily].map((entry) => ({ ...entry, tags: [...entry.tags] }));
};

/** Convenience predicate matching `services/entryCompat.ts::isSampleEntry`
 *  for callers that don't want to import the legacy compat layer. */
export const isSampleId = (id: string): boolean => id.startsWith('sample-');
