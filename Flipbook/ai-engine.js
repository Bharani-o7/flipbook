// Flipbook AI engine: free Hugging Face models that run on the reader's own device (Transformers.js).
// The model downloads once from huggingface.co, is cached by the browser, then works offline. No server, no limits.
// Uses the GPU through WebGPU when available (Chrome/Edge, Safari 26+, Android Chrome); otherwise the CPU (slower).
(() => {
  'use strict';

  const MODELS = {
    small:  { name: 'Qwen3 0.6B',         label: 'Fast',     size: 'about 0.6 GB', id: 'onnx-community/Qwen3-0.6B-ONNX',    noThink: true },
    medium: { name: 'Gemma 3 1B',         label: 'Balanced', size: 'about 1 GB',   id: 'onnx-community/gemma-3-1b-it-ONNX' },
    large:  { name: 'Jan-nano 4B (Qwen3)', label: 'Smartest', size: 'about 2.8 GB', id: 'onnx-community/Jan-nano-ONNX',      noThink: true }
  };
  for (const k in MODELS) MODELS[k].hf = 'https://huggingface.co/' + MODELS[k].id;
  const WORKER_URL = () => new URL('vendor/transformers/ai-worker.js', location.href);
  const WASM_PATH = () => new URL('vendor/transformers/', location.href).href;
  const CACHE_NAME = 'transformers-cache';

  const st = { state: 'idle', key: null, loadedKey: null, dev: null, worker: null, progress: 0, text: '', error: '', listeners: new Set() };
  const pref = {
    get() { try { return localStorage.getItem('fb:aiModel') || 'auto'; } catch (e) { return 'auto'; } },
    set(v) { try { localStorage.setItem('fb:aiModel', v); } catch (e) {} }
  };
  const emit = () => st.listeners.forEach(f => { try { f(); } catch (e) {} });

  async function detect() {
    if (st.dev) return st.dev;
    const ua = navigator.userAgent, d = { webgpu: false, f16: false };
    d.ipad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    d.phone = !d.ipad && (/iPhone|iPod/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua)));
    d.tablet = d.ipad || (/Android/.test(ua) && !/Mobile/.test(ua));
    d.memory = navigator.deviceMemory || 0;
    // Inside an app's web view (the Flipbook phone app, or any in-app browser) the OS gives the
    // page far less memory than a real browser tab, and kills the process rather than swapping.
    d.webview = /\bwv\b/.test(ua) || (/iPhone|iPad|iPod/.test(ua) && !/Safari/.test(ua));
    d.secure = window.isSecureContext && location.protocol !== 'file:';
    d.wasm = typeof WebAssembly === 'object';
    try {
      if (navigator.gpu) { const a = await navigator.gpu.requestAdapter(); if (a) { d.webgpu = true; d.f16 = a.features.has('shader-f16'); } }
    } catch (e) {}
    return (st.dev = d);
  }
  // Without a usable GPU, only the small model is quick enough on the CPU. Phones and web views
  // get the small one whatever the GPU reports: a 1 GB model is past what iOS lets a web view's
  // process hold, and the OS kills the process instead of swapping, which blanks the page.
  const autoKey = d => (!d.webgpu || d.phone || d.webview) ? 'small'
    : d.tablet ? 'medium' : (d.memory && d.memory < 8) ? 'medium' : 'large';
  const allowedKey = (k, d) => (!d.webgpu && k === 'large') ? 'medium' : k;

  async function isCached(id) {
    try {
      if (!('caches' in window)) return false;
      const keys = await (await caches.open(CACHE_NAME)).keys();
      return keys.some(r => r.url.includes('/' + id + '/') && /\.onnx/.test(r.url));
    } catch (e) { return false; }
  }

  function worker() {
    if (st.worker) return st.worker;
    const w = new Worker(WORKER_URL(), { type: 'module' });
    w.onmessage = onMessage;
    w.onerror = e => { fail(String((e && e.message) || 'worker error')); };
    return (st.worker = w);
  }

  // ---- messages coming back from the worker
  const jobs = new Map(); let seq = 0;
  const files = new Map();
  function onMessage({ data: m }) {
    if (m.type === 'progress') {
      if (m.file && m.total) files.set(m.file, { loaded: m.loaded || 0, total: m.total });
      if (m.status === 'done' && m.file && files.has(m.file)) { const f = files.get(m.file); f.loaded = f.total; }
      let loaded = 0, total = 0; files.forEach(f => { loaded += f.loaded; total += f.total; });
      st.progress = total ? loaded / total : 0;
      const pct = Math.round(st.progress * 100);
      st.text = st.fromCache ? `Loading the AI from this device… ${pct}%` : `Downloading the free AI (one time)… ${pct}%`;
      if (pct >= 100) st.text = 'Getting the AI ready…';
      emit();
    } else if (m.type === 'ready') {
      st.device = m.device; st.loadedKey = st.key; st.state = 'ready'; emit();
    } else if (m.type === 'token') {
      const j = jobs.get(m.id); if (j) j.push(m.text);
    } else if (m.type === 'done') {
      const j = jobs.get(m.id); if (j) j.end();
    } else if (m.type === 'error') {
      const j = m.id && jobs.get(m.id);
      if (j) j.end(new Error(m.message)); else fail(m.message);
    }
  }
  function fail(msg) {
    console.warn('AI error:', msg);
    st.state = 'error';
    st.error = /memory|allocat|device.*lost|OOM|out of/i.test(msg) ? 'This device ran out of memory starting that AI. Try a smaller model.'
      : navigator.onLine === false ? "You're offline. The first download needs internet; after that the AI works offline."
      : /fetch|network|load failed|could not locate|404|403|unable to get/i.test(msg) ? "Couldn't download the AI from Hugging Face. Check your internet connection (or a network/firewall blocking huggingface.co) and try again."
      : 'The AI could not start on this device. Try a smaller model or another browser.';
    jobs.forEach(j => j.end(new Error(msg)));
    emit();
  }

  // Decide which model this device uses; start right away if it was downloaded before.
  async function prepare() {
    const d = await detect();
    if (!d.secure) { st.state = 'none'; st.why = 'file'; return emit(); }
    if (!d.wasm) { st.state = 'none'; st.why = 'webgpu'; return emit(); }
    const p = pref.get();
    st.key = allowedKey(MODELS[p] ? p : autoKey(d), d);
    if (st.loadedKey === st.key && st.state === 'ready') return emit();
    if (st.state === 'loading') return;
    if (await isCached(MODELS[st.key].id)) return start();
    st.state = 'need-download'; emit();
  }

  async function start() {
    st.state = 'loading'; st.progress = 0; st.error = ''; files.clear();
    st.fromCache = await isCached(MODELS[st.key].id);
    st.text = st.fromCache ? 'Loading the AI from this device…' : 'Starting the download…';
    emit();
    try { worker().postMessage({ type: 'load', model: MODELS[st.key].id, wasmPaths: WASM_PATH() }); }
    catch (e) { fail(String(e && e.message || e)); }
  }

  // Streams the answer as text pieces. `messages` = [{role:'system'|'user'|'assistant', content}]
  async function* generate(messages, signal) {
    if (st.state !== 'ready') throw new Error('not ready');
    const m = MODELS[st.loadedKey];
    const msgs = messages.map(x => ({ role: x.role, content: x.content }));
    if (m && m.noThink && msgs.length) msgs[msgs.length - 1].content += ' /no_think'; // Qwen3: answer directly
    const id = ++seq, queue = []; let wake = null, finished = false, error = null;
    jobs.set(id, {
      push: t => { queue.push(t); if (wake) { wake(); wake = null; } },
      end: e => { finished = true; error = e || null; if (wake) { wake(); wake = null; } }
    });
    const onAbort = () => { try { st.worker.postMessage({ type: 'stop' }); } catch (e) {} };
    signal && signal.addEventListener('abort', onAbort);
    st.worker.postMessage({ type: 'generate', id, messages: msgs, maxNewTokens: 600 });
    let raw = '', shown = '';
    try {
      for (;;) {
        if (!queue.length && !finished) await new Promise(r => { wake = r; });
        while (queue.length) {
          raw += queue.shift();
          const clean = raw.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').replace(/^\s+/, ''); // hide any "thinking" text
          if (clean.length > shown.length) { yield clean.slice(shown.length); shown = clean; }
        }
        if (finished) break;
      }
      if (error && !(signal && signal.aborted)) throw error;
    } finally {
      jobs.delete(id);
      signal && signal.removeEventListener('abort', onAbort);
    }
  }

  async function deleteDownloads() {
    let n = 0;
    try {
      const cache = await caches.open(CACHE_NAME);
      for (const req of await cache.keys()) {
        if (Object.values(MODELS).some(m => req.url.includes('/' + m.id + '/'))) { await cache.delete(req); n++; }
      }
    } catch (e) {}
    if (st.worker) { st.worker.terminate(); st.worker = null; }
    st.loadedKey = null; st.state = 'idle'; emit();
    return n;
  }

  window.FlipbookAI = {
    MODELS, st, prepare, start, generate, deleteDownloads, detect,
    pref: () => pref.get(),
    setPref: async v => { pref.set(v); if (st.state !== 'loading') st.state = 'idle'; await prepare(); },
    current: () => st.key ? MODELS[st.key] : null,
    autoKey: () => st.dev ? autoKey(st.dev) : null,
    onChange: f => st.listeners.add(f),
    // How much book text to give the AI per question (smaller on CPU-only devices so answers stay quick).
    budget: sample => {
      const cjk = /[぀-ヿ㐀-鿿가-힯]/.test(sample || '');
      const cpu = st.dev && !st.dev.webgpu;
      return cjk ? (cpu ? 1500 : 2600) : (cpu ? 3500 : 7000);
    }
  };
})();
