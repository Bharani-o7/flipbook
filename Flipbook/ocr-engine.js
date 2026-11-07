// Flipbook OCR: reads text off scanned pages and images, on the reader's own device (Tesseract.js).
// English is bundled in vendor/tesseract/ so it works offline; nothing is uploaded.
(() => {
  'use strict';
  const V = 'vendor/tesseract/';
  const st = { worker: null, lang: null, loadingP: null, libP: null };
  const pref = {
    get() { try { return localStorage.getItem('fb:ocrLang') || 'eng'; } catch (e) { return 'eng'; } },
    set(v) { try { localStorage.setItem('fb:ocrLang', v); } catch (e) {} }
  };
  const supported = typeof WebAssembly === 'object' && typeof Worker === 'function';

  function loadLib() {
    if (window.Tesseract) return Promise.resolve();
    return st.libP || (st.libP = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = V + 'tesseract.min.js';
      s.onload = res; s.onerror = () => { st.libP = null; rej(new Error('Could not load the text-recognition engine.')); };
      document.head.appendChild(s);
    }));
  }

  async function getWorker(onStatus) {
    const lang = pref.get();
    if (st.worker && st.lang === lang) return st.worker;
    if (st.loadingP) return st.loadingP;
    st.loadingP = (async () => {
      await loadLib();
      if (st.worker) { try { await st.worker.terminate(); } catch (e) {} st.worker = null; }
      const worker = await Tesseract.createWorker(lang, 1, {
        workerPath: V + 'worker.min.js', corePath: V, langPath: V,
        workerBlobURL: false, gzip: true, cacheMethod: 'none',
        logger: m => { if (onStatus && m.status === 'loading language traineddata') onStatus('Preparing text recognition…'); }
      });
      st.worker = worker; st.lang = lang; return worker;
    })();
    try { return await st.loadingP; } finally { st.loadingP = null; }
  }

  // source: a canvas, image, blob or data URL. Returns recognized plain text.
  async function recognize(source, { onStatus, signal } = {}) {
    if (!supported) throw new Error('This browser cannot run text recognition.');
    const worker = await getWorker(onStatus);
    if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (onStatus) onStatus('Reading the image…');
    const { data } = await worker.recognize(source);
    return { text: (data.text || '').replace(/­/g, ''), confidence: data.confidence || 0 };
  }

  async function dispose() { if (st.worker) { try { await st.worker.terminate(); } catch (e) {} st.worker = null; st.lang = null; } }

  window.FlipbookOCR = {
    supported, recognize, dispose,
    lang: () => pref.get(),
    setLang: async v => { pref.set(v); await dispose(); },
    // languages bundled or droppable into vendor/tesseract/ as <code>.traineddata.gz
    LANGS: { eng: 'English', spa: 'Spanish', fra: 'French', deu: 'German', ita: 'Italian', por: 'Portuguese', nld: 'Dutch', chi_sim: 'Chinese (Simplified)', jpn: 'Japanese', kor: 'Korean', ara: 'Arabic', hin: 'Hindi', rus: 'Russian' }
  };
})();
