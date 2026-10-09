import { mkdir, readFile, writeFile } from 'node:fs/promises';
import express from 'express';
import { loadEnv } from 'vite';
import { avatarEvaluationCases } from '../evals/avatar/corpus';
import { registerAvatarChatRoutes } from '../server/avatarChatRoutes';
import { validateModelConfig } from '../server/avatarCustomModel';
import { chooseProvider, resolveProviderModel, type ProviderConfig } from '../server/aiProviders';
import { AVATAR_BEHAVIOR_VERSION } from '../services/avatarBehaviorStandard';
import type { AvatarModelConfig } from '../features/now/api/avatarModel';

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
const modelConfigFlag = process.argv.indexOf('--model-config');
const modelConfigPath = modelConfigFlag >= 0 ? process.argv[modelConfigFlag + 1] : undefined;
if (modelConfigFlag >= 0 && !modelConfigPath) {
  throw new Error('缺少 --model-config 的配置文件路径');
}
const customModelConfig: AvatarModelConfig | undefined = modelConfigPath
  ? validateModelConfig(JSON.parse(await readFile(modelConfigPath, 'utf8')))
  : undefined;

// No browser reads, real records, model credentials, or model-side grading in output.
const config: ProviderConfig = {
  forcedProvider:
    env.AI_PROVIDER === 'gemini' ? 'gemini' : env.AI_PROVIDER === 'openrouter' ? 'openrouter' : '',
  openrouterKey: env.OPENROUTER_API_KEY ?? '',
  openrouterModel: env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
  openrouterReferer: '',
  openrouterTitle: 'VECTOR synthetic evaluation',
  openrouterJsonMode: true,
  geminiKey: env.GEMINI_API_KEY ?? '',
  geminiModel: env.GEMINI_MODEL ?? 'gemini-2.0-flash',
};
const provider = chooseProvider(config);
const run = process.argv.includes('--run');
const split = process.argv.includes('--holdout') ? 'holdout' : 'development';
const selected = avatarEvaluationCases.filter((c) => c.split === split);
const results: unknown[] = [];
const app = express();
app.use(express.json());
registerAvatarChatRoutes(app, config);
// Evaluation must use an explicitly selected model. A custom config follows
// the same server route as the product's "模型接入" setting; environment
// providers remain only as a backwards-compatible local-runner option.
const selectedModel =
  customModelConfig?.model ?? (provider ? resolveProviderModel(config, provider) : null);
const server = run && selectedModel ? app.listen(0, '127.0.0.1') : undefined;
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
              ...(customModelConfig ? { modelConfig: customModelConfig } : {}),
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
        model: selectedModel,
        modelSelection: customModelConfig ? 'user-config-file' : provider ? 'environment' : null,
        executed: !!server,
        reason: run ? (selectedModel ? null : 'model_not_configured') : 'manifest_only',
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
