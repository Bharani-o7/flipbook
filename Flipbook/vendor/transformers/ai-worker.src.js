// Flipbook AI worker: runs a free Hugging Face model on the reader's own device (Transformers.js).
// Runs in the background so page turning and scrolling stay smooth while the AI thinks.
import { pipeline, env, TextStreamer, InterruptableStoppingCriteria } from '@huggingface/transformers';

env.allowLocalModels = false;   // models come from huggingface.co and are cached by the browser
env.useBrowserCache = true;

let generator = null;
let loadedKey = '';
const stopper = new InterruptableStoppingCriteria();

async function pickDevice() {
  try {
    if (self.navigator && navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return { device: 'webgpu', f16: adapter.features.has('shader-f16') };
    }
  } catch (e) { /* fall through to WebAssembly */ }
  return { device: 'wasm', f16: false };
}

// The AI runtime (28 MB) ships as two halves so it fits the 25 MB file limit of GitHub and Cloudflare Pages.
async function loadRuntime(base) {
  const names = ['ort-wasm-simd-threaded.asyncify.wasm.part1', 'ort-wasm-simd-threaded.asyncify.wasm.part2'];
  const parts = await Promise.all(names.map(async n => {
    const r = await fetch(base + n);
    if (!r.ok) throw new Error('Failed to fetch ' + n);
    return new Uint8Array(await r.arrayBuffer());
  }));
  const out = new Uint8Array(parts[0].length + parts[1].length);
  out.set(parts[0], 0); out.set(parts[1], parts[0].length);
  return out.buffer;
}

async function load({ model, wasmPaths }) {
  if (wasmPaths) {
    env.backends.onnx.wasm.wasmPaths = wasmPaths;
    if (!env.backends.onnx.wasm.wasmBinary) env.backends.onnx.wasm.wasmBinary = await loadRuntime(wasmPaths);
  }
  const { device, f16 } = await pickDevice();
  const dtype = device === 'webgpu' && f16 ? 'q4f16' : 'q4';
  const key = model + '|' + device + '|' + dtype;
  if (generator && loadedKey === key) { self.postMessage({ type: 'ready', device }); return; }
  if (generator) { try { await generator.dispose(); } catch (e) {} generator = null; }
  generator = await pipeline('text-generation', model, {
    device, dtype,
    progress_callback: p => self.postMessage({ type: 'progress', ...p })
  });
  loadedKey = key;
  self.postMessage({ type: 'ready', device });
}

async function generate({ id, messages, maxNewTokens }) {
  stopper.reset();
  const streamer = new TextStreamer(generator.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: text => self.postMessage({ type: 'token', id, text })
  });
  await generator(messages, {
    max_new_tokens: maxNewTokens || 512,
    do_sample: false,
    repetition_penalty: 1.1,
    streamer,
    stopping_criteria: stopper
  });
  self.postMessage({ type: 'done', id });
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'load') await load(data);
    else if (data.type === 'generate') await generate(data);
    else if (data.type === 'stop') stopper.interrupt();
  } catch (err) {
    self.postMessage({ type: 'error', id: data.id, message: String((err && err.message) || err) });
  }
};
