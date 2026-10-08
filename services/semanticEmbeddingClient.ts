type EmbedWorkerResponse =
  | { requestId: string; type: 'result'; vectors: number[][] }
  | { message: string; requestId: string; type: 'error' };

type PendingRequest = {
  reject: (reason?: unknown) => void;
  resolve: (vectors: number[][]) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const EMBEDDING_TIMEOUT_MS = 180_000;
const pendingRequests = new Map<string, PendingRequest>();
let embeddingWorker: Worker | null = null;
let requestCounter = 0;

const rejectPendingRequests = (reason: Error) => {
  for (const pending of pendingRequests.values()) {
    clearTimeout(pending.timeoutId);
    pending.reject(reason);
  }
  pendingRequests.clear();
};

const resetWorker = (reason: Error) => {
  embeddingWorker?.terminate();
  embeddingWorker = null;
  rejectPendingRequests(reason);
};

const getWorker = (): Worker => {
  if (embeddingWorker) return embeddingWorker;
  if (typeof Worker === 'undefined') {
    throw new Error('Local neural embeddings are unavailable in this environment');
  }

  embeddingWorker = new Worker(new URL('./semanticEmbedding.worker.ts', import.meta.url), {
    name: 'vector-semantic-embedding',
    type: 'module',
  });
  embeddingWorker.onmessage = (event: MessageEvent<EmbedWorkerResponse>) => {
    const response = event.data;
    const pending = pendingRequests.get(response.requestId);
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    pendingRequests.delete(response.requestId);

    if (response.type === 'error') {
      pending.reject(new Error(response.message));
    } else {
      pending.resolve(response.vectors);
    }
  };
  embeddingWorker.onerror = () => {
    resetWorker(new Error('Local neural embedding worker failed'));
  };
  return embeddingWorker;
};

export const embedTextsLocally = (texts: string[]): Promise<number[][]> => {
  if (texts.length === 0) return Promise.resolve([]);
  const worker = getWorker();
  requestCounter += 1;
  const requestId = `semantic-${Date.now()}-${requestCounter}`;

  return new Promise<number[][]>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Local neural embedding timed out'));
    }, EMBEDDING_TIMEOUT_MS);
    pendingRequests.set(requestId, { reject, resolve, timeoutId });
    worker.postMessage({ requestId, texts, type: 'embed' });
  });
};

export const disposeSemanticEmbeddingWorker = () => {
  resetWorker(new Error('Local neural embedding worker disposed'));
};
