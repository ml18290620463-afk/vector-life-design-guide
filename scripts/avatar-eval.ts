import { mkdir, writeFile } from 'node:fs/promises';
import express from 'express';
import { avatarEvaluationCases } from '../evals/avatar/corpus';
import { registerAvatarChatRoutes } from '../server/avatarChatRoutes';
import { chooseProvider, resolveProviderModel, type ProviderConfig } from '../server/aiProviders';
import { AVATAR_BEHAVIOR_VERSION } from '../services/avatarBehaviorStandard';

// No browser reads, real records, model credentials, or model-side grading in output.
const config: ProviderConfig = {
  forcedProvider:
    process.env.AI_PROVIDER === 'gemini'
      ? 'gemini'
      : process.env.AI_PROVIDER === 'openrouter'
        ? 'openrouter'
        : '',
  openrouterKey: process.env.OPENROUTER_API_KEY ?? '',
  openrouterModel: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
  openrouterReferer: '',
  openrouterTitle: 'VECTOR synthetic evaluation',
  openrouterJsonMode: true,
  geminiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
};
const provider = chooseProvider(config);
const run = process.argv.includes('--run');
const split = process.argv.includes('--holdout') ? 'holdout' : 'development';
const selected = avatarEvaluationCases.filter((c) => c.split === split);
const results: unknown[] = [];
const app = express();
app.use(express.json());
registerAvatarChatRoutes(app, config);
const server = run && provider ? app.listen(0, '127.0.0.1') : undefined;
try {
  if (server)
    await new Promise<void>((resolve) =>
      server.listening ? resolve() : server.once('listening', resolve),
    );
  const address = server?.address();
  for (const item of selected) {
    for (const condition of ['with-history', 'current-conversation-only'] as const) {
      let messages: { role: 'user' | 'assistant'; content: string }[] = [];
      let memories = item.steps[0].memories ?? [];
      for (const [stepIndex, step] of item.steps.entries()) {
        if (step.newSession) messages = [];
        if (step.memories !== undefined) memories = step.memories;
        messages.push({ role: 'user', content: step.question });
        let status = 'not_run',
          reply: string | null = null,
          error: string | null = null;
        const start = performance.now();
        if (server && address && typeof address !== 'string') {
          const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/avatar/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages,
              memories: condition === 'with-history' ? memories : [],
            }),
            signal: AbortSignal.timeout(50_000),
          }).catch(() => null);
          const body = await response?.json().catch(() => null);
          reply = response?.ok && typeof body?.reply === 'string' ? body.reply : null;
          status = reply ? 'awaiting_human_review' : 'call_failed';
          error = reply ? null : (body?.error ?? 'request_failed');
          if (reply) messages.push({ role: 'assistant', content: reply });
        }
        results.push({
          id: item.id,
          step: stepIndex + 1,
          condition,
          category: item.category,
          question: step.question,
          expected: step.expected,
          forbidden: step.forbidden,
          newSession: !!step.newSession,
          status,
          reply,
          error,
          latencyMs: reply ? Math.round(performance.now() - start) : null,
          grade: null,
          hardFailure: null,
          reviewer: null,
        });
        // A missing reply changes the dialogue; never score later turns as an intact conversation.
        if (status === 'call_failed') break;
      }
    }
  }
  await mkdir('output/avatar-eval', { recursive: true });
  const path = `output/avatar-eval/${split}-${Date.now()}.json`;
  await writeFile(
    path,
    JSON.stringify(
      {
        version: AVATAR_BEHAVIOR_VERSION,
        split,
        model: provider ? resolveProviderModel(config, provider) : null,
        executed: !!server,
        reason: run ? (provider ? null : 'model_not_configured') : 'manifest_only',
        qualityScore: null,
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    `${path}: ${selected.length} synthetic cases; ${server ? 'human review required' : 'no model calls or quality score'}`,
  );
} finally {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
}
