import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/bge-small-zh-v1.5';

type EmbedRequest = {
  requestId: string;
  texts: string[];
  type: 'embed';
};

type WorkerMessage =
  | { requestId: string; type: 'result'; vectors: number[][] }
  | { message: string; requestId: string; type: 'error' };

type WorkerScope = {
  onmessage: ((event: MessageEvent<EmbedRequest>) => void) | null;
  postMessage: (message: WorkerMessage) => void;
};

const workerScope = self as unknown as WorkerScope;

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/models/';
const isSafari =
  typeof navigator !== 'undefined' &&
  /safari/i.test(navigator.userAgent) &&
  !/chrome|chromium|android/i.test(navigator.userAgent);
const wasmRuntimeAssets = isSafari
  ? {
      mjs: new URL(
        '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',
        import.meta.url,
      ).href,
      wasm: new URL(
        '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
        import.meta.url,
      ).href,
    }
  : {
      mjs: new URL(
        '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs',
        import.meta.url,
      ).href,
      wasm: new URL(
        '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm',
        import.meta.url,
      ).href,
    };
env.backends.onnx.wasm.wasmPaths = wasmRuntimeAssets;
env.backends.onnx.wasm.numThreads = 1;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

const getExtractor = () => {
  extractorPromise ??= pipeline('feature-extraction', MODEL_ID, {
    dtype: 'q8',
    device: 'wasm',
  });
  return extractorPromise;
};

const embed = async (texts: string[]): Promise<number[][]> => {
  const extractor = await getExtractor();
  const output = await extractor(texts, { normalize: true, pooling: 'cls' });
  const dimensions = output.dims.at(-1);
  if (!dimensions || output.data.length !== texts.length * dimensions) {
    throw new Error('Unexpected local embedding output shape');
  }

  const values = output.data as Float32Array;
  return texts.map((_, index) =>
    Array.from(values.slice(index * dimensions, (index + 1) * dimensions)),
  );
};

workerScope.onmessage = (event) => {
  const { requestId, texts, type } = event.data;
  if (type !== 'embed' || !Array.isArray(texts) || texts.length === 0) return;

  void embed(texts)
    .then((vectors) => workerScope.postMessage({ requestId, type: 'result', vectors }))
    .catch((error: unknown) =>
      workerScope.postMessage({
        message: error instanceof Error ? error.message : 'Local embedding failed',
        requestId,
        type: 'error',
      }),
    );
};

export {};
