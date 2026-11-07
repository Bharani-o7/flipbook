# Flipbook security review

**Scope:** web app (`index.html`, `app.js`, `ai-engine.js`, `sw.js`), bundled PDF.js 6.5.438, Transformers.js 4.3.2 + ONNX Runtime Web.
**Update (Nov 7, 2026):** Ask AI now runs a free Hugging Face model **on the reader's device**. The Claude-based AI server was removed, so every server-side finding below (F1, F2, F4, F5, F10, F11) **no longer applies**: there is no server, no API key and no bill to protect. The app-side fixes all remain in place.
**Result:** all findings fixed or retired; full regression passes (652 automated checks).

| # | Finding | Severity | Status |
|---|---|---|---|
| F1 | AI server callable outside the app (cost exposure) | High | Retired: AI server removed; AI runs on each reader's device at no cost |
| F2 | Book title inserted into the AI's rules | High | Fixed in the app too: titles are cleaned before reaching the model |
| F3 | PDF.js 3.11.174 affected by CVE-2024-4367 | High | Fixed (PDF.js 6.5.438) |
| F4 | Invented "AI" turns in chat history | Medium | Retired: history never leaves the device and only affects the reader's own answers |
| F5 | Unbounded request body on the server | Medium | Retired: server removed |
| F6 | Library identity collision (same name + size) | Medium | Fixed |
| F7 | Leaving a book mid-answer | Medium | Fixed (re-verified with the on-device AI) |
| F8 | Extreme page shapes (0-px / oversized canvases) | Low | Fixed |
| F9 | Error page could become the offline copy | Low | Fixed |
| F10 | Server CORS/origin details | Low | Retired: server removed |
| F11 | IPv6 rate-limit rotation | Low | Retired: server removed |
| F12 | Clear chat before confirmation | Low | Fixed |
| F13 | Shared origin on GitHub Pages | Info | Fixed (Cloudflare Pages option) |
| F14 | Third-party font stylesheet | Info | Fixed (fonts bundled) |

## On-device AI: security notes
- **Network:** the security policy allows outside connections only to Hugging Face (`huggingface.co`, `*.huggingface.co`, `*.hf.co`) for the one-time model download. The app makes no outside requests until the reader taps **Download & start** (verified).
- **Code execution:** the AI runtime is bundled locally (`vendor/transformers/`). The policy allows WebAssembly compilation (`wasm-unsafe-eval`) but no JavaScript `eval` and no inline scripts. Model files are data (weights, tokenizer), not code.
- **Privacy:** questions, book text and answers stay on the device; nothing is sent anywhere. Scanned-page/image text recognition (Tesseract) also runs fully on-device; the bundled English data and the engine load from the app's own origin, and the security policy allows no OCR-related third-party connections.
- **File wrapping:** images and text files are converted to a PDF locally with pdf-lib (bundled); the bytes never leave the device.
- **Book-only rule (three layers):** a gate refuses questions that share no words with the book (follow-ups excepted) before the model runs; the model is told to answer only from the passages and cite pages; and an answer check holds back any answer until it cites a page from the passages the model was given. Off-topic text from the model's own knowledge is never displayed, citations to pages it wasn't given are removed or blocked, and blocked answers are never reused as chat history. Because it all runs on the reader's own device, someone who edits the app can only change their own copy, with no cost or impact on anyone else.
- **Prompt injection inside a PDF:** text in a book could try to steer the model, but it can only affect that reader's own answers on their own device; the model has no tools, no network access and no access to other books.
- **Output handling:** model output is escaped before display; only plain page numbers become links (verified with markup-laden answers).

---|---|---|---|
| F1 | AI server can be called by non-browser clients (Origin is not authentication), creating cost exposure | High | Fixed (bot check + signed sessions + daily caps) |
| F2 | Book title inserted into the AI's rules (prompt injection) | High | Fixed |
| F3 | Bundled PDF.js 3.11.174 is in the range affected by CVE-2024-4367 | High | Fixed (upgraded to PDF.js 6.5.438) |
| F4 | Chat history could carry invented "AI" turns | Medium | Fixed |
| F5 | Request body read fully into memory before size checks | Medium | Fixed |
| F6 | Two different PDFs with the same name and size share one library record | Medium | Fixed |
| F7 | Leaving a book mid-answer: request kept running, next question silently dropped | Medium | Fixed |
| F8 | Hair-thin pages rendered to a 0-pixel canvas; extreme page shapes made oversized covers | Low | Fixed |
| F9 | Service worker could store an error page as the offline copy of the app | Low | Fixed |
| F10 | CORS answered refused sites with `Access-Control-Allow-Origin: null`; case-sensitive origin match; health endpoint revealed configuration | Low | Fixed |
| F11 | IPv6 visitors could rotate addresses within their own /64 to exceed the per-visitor limit | Low | Fixed |
| F12 | "Clear chat" stopped the running answer before the user confirmed | Low | Fixed |
| F13 | All GitHub Pages sites of one account share a browser origin | Info | Fixed (Cloudflare Pages option gives Flipbook its own origin) |
| F14 | Third-party font stylesheet (Google Fonts) | Info | Fixed (fonts bundled) |

---

### F1: Server callable outside the app (cost exposure) · High (retired: server removed)
**Explanation:** The server accepts requests whose `Origin` header matches `ALLOWED_ORIGINS`. Browsers set that header honestly, but any non-browser HTTP client can set it to anything. Such a client can send its own "document" text and questions, using your API credit up to the request limits. Because the app supplies the document, the server can't prove the text came from a real book.
**How it would be triggered:** an HTTP request sent directly to `/ask` from a script, with the allowed origin set by hand.
**Remediation applied:**
- Per-visitor **daily cap** (`DAILY_LIMIT_PER_VISITOR`, default 150) and an app-wide daily cap (`DAILY_LIMIT_TOTAL`, default 3000), enforced by a strongly consistent Durable Object counter. Worst-case daily spend is now bounded by configuration.
- Per-minute limit (10/min) keyed per IPv4 address or per IPv6 /64 (see F11).
- Fixed model, output length and rules on the server; book text is capped at about 80k tokens per request.
- The setup guide requires a monthly spend limit in the Claude Console.

- **Bot check (Cloudflare Turnstile).** With `TURNSTILE_SECRET` set, `/ask` requires a session token. A reader's browser solves an invisible Turnstile check once; the server verifies the token with Cloudflare (including that it was solved on one of *your* sites), then issues an HMAC-signed session bound to that visitor's IPv4 address or /64 and valid for 12 hours. Copied, altered or expired sessions are refused; the app redoes the check automatically when needed. A script can no longer use the server just by setting the `Origin` header.

**What remains:** someone could still solve Turnstile in a real browser and then use their 12-hour session within the per-visitor caps. That's the normal limit of any public, sign-in-free service, and the caps bound its cost.

### F2: Prompt injection through the book title · High
**Explanation:** The title (taken from the file name) was inserted into the system rules with only quote characters removed. Line breaks and instruction-like text in a file name would have appeared inside the rules section, which carries more weight than document text. The title was also placed in an XML attribute without escaping `"`.
**How it would be triggered:** a PDF whose file name contains line breaks and rule-like sentences, or the same text sent in the `title` field.
**Remediation applied:** `cleanTitle()` normalizes Unicode; removes control characters, line/paragraph separators and bidi overrides; strips quotes, brackets, backslashes and angle brackets; collapses whitespace; and caps the title at 120 characters. Attribute values now use `escAttr()`. Verified: a multi-line title arrives as one inert line.

### F3: PDF.js 3.11.174 and CVE-2024-4367 · High (fixed)
**Explanation:** PDF.js versions before 4.2.67 can execute script from a crafted font when its font-compiling `eval` path is enabled. The vendored 3.11.174 is in that range.
**Mitigation (already in place, now with defence in depth):**
- `getDocument({ isEvalSupported: false })`, the official workaround, disables that code path.
- New Content-Security-Policy: `script-src 'self'` with no `unsafe-eval` and no inline scripts, so even a regression couldn't run injected code. The one inline handler (font loading) moved into `app.js`.
- Verified: rendering a PDF with embedded fonts never calls `Function`/`eval`, with zero policy violations.

**Fix applied:** upgraded to **PDF.js 6.5.438** (legacy build, for older iPhones and Androids too). The vulnerable font-compiler code no longer exists; the library contains no `eval` or `new Function`. It runs in a background module worker when hosted. When opened from disk (`file://`), where browsers refuse module workers, it uses a classic-script build of the same official code. The new version also brings bundled CJK character maps, standard fonts, and JPEG 2000/JBIG2 image decoders (WebAssembly; the policy allows only `wasm-unsafe-eval`, not JavaScript eval).

### F4: Invented AI turns in chat history · Medium
**Explanation:** The app sends earlier questions and answers so follow-ups make sense. The server trusted every `assistant` turn, so a modified client could insert a fake earlier "answer" in which the AI appears to have agreed to drop its rules, which makes later rule-breaking more likely.
**How it would be triggered:** a request whose `history` contains assistant messages the server never produced.
**Remediation applied:** the server signs each complete answer with HMAC-SHA-256 (key from `HISTORY_SECRET`, or derived from the API key) and sends the signature with the final stream event. The app stores it with the answer. On later requests, assistant turns without a valid signature are dropped together with their question. Incomplete (stopped/failed) answers are never signed. Verified: a signed answer is accepted, an edited one is dropped.

### F5: Unbounded request body · Medium
**Explanation:** `request.json()` read the whole body before any size check, so very large bodies cost memory and CPU on every request.
**Remediation applied:** requests are refused with 413 if `Content-Length` exceeds 1.2 MB, and the body is read through a streaming counter that cancels past the cap, even if the header is missing or wrong. Verified with a 1.3 MB body.

### F6: Library identity collision · Medium
**Explanation:** Books were keyed by `name|size`. Two different PDFs with the same name and byte size (common for exports like `notes.pdf`) shared one record, so the second file replaced the first in storage and inherited its notes, highlights, chat and reading position.
**How it would be triggered:** open two different same-size files with the same name.
**Remediation applied:** books are keyed by the SHA-256 of their content (with a `name|size|lastModified` fallback where `crypto.subtle` is unavailable, e.g. `file://`). Records from older versions migrate automatically, but only after confirming the stored file has the same hash. Verified with two same-name, same-size files.

### F7: Leaving a book while the AI is answering · Medium
**Explanation:** Closing a book didn't stop the running request. The app stayed "busy", so the first question in the next book was silently ignored, and the old book kept a reply with endless typing dots.
**Remediation applied:** closing a book aborts the request; the old reply is marked "Stopped." and left out of future history. Verified.

### F8: Extreme page shapes · Low
**Explanation:** A 3 × 14,400 pt page rendered to a 0-pixel-wide canvas (an invisible page; confirmed in testing), and cover/thumbnail sizes were computed from one side only, allowing very large canvases.
**Remediation applied:** canvases are at least 1 px and at most 4096 px per side; covers fit within 360 × 1200 and thumbnails within 400 × 220. Verified with very tall and very wide pages.

### F9: Offline copy could be replaced by an error page · Low
**Explanation:** The service worker saved the response to any page navigation as the offline `index.html`, including 404 pages.
**Remediation applied:** only successful (`200`) loads of the app's own start page refresh the offline copy. Verified: visiting a missing page, then going offline, still loads the app.

### F10: CORS and information details · Low
**Remediation applied:** refused origins get no `Access-Control-Allow-Origin` header at all (previously `null`, which sandboxed frames and local files also use); origins compare case-insensitively; `/health` now returns only `{ ok, configured }`.

### F11: IPv6 limit rotation · Low
**Explanation:** One IPv6 connection usually owns a whole /64 (18 quintillion addresses), so keying limits on the full address let one device appear as many visitors.
**Remediation applied:** IPv6 visitors are keyed by their /64 network. Verified: 12 addresses in one /64 share one limit.

### F12: Clear chat before confirmation · Low
**Remediation applied:** the confirmation dialog appears first; the answer stops only if the user confirms.

### F13: Shared origin on GitHub Pages · Informational (fixed)
All of an account's GitHub Pages sites (`username.github.io/*`) share one browser origin, so another site you publish there could read Flipbook's saved books and notes. **Fix:** the README now includes a two-command Cloudflare Pages deployment that gives Flipbook its own origin (`flipbook.pages.dev`), copying only the app files (never `ai-server/` or a local `.dev.vars`). A custom domain also works.

### F14: Third-party stylesheet · Informational (fixed)
**Fix:** Inter, Literata and Fraunces are bundled in `fonts/` (444 KB, SIL Open Font License) and cached for offline use. The security policy no longer allows any font or style host other than the app itself, and the app makes no third-party requests (except the optional Turnstile check).

---

## Verified safe
- **Script injection (XSS):** PDF text, chapter titles, file names, search snippets, notes, highlights and AI answers are all escaped before display. Markup inside a PDF or file name shows as plain text. AI citations become links only for plain page numbers within the book. Verified with markup-laden PDFs and file names.
- **Secrets:** the API key exists only as a Cloudflare secret; it never appears in the app, the repo, or responses. `.dev.vars` is git-ignored.
- **Server-controlled behaviour:** the app can't change the model, output length or rules (verified: client-sent `model`, `max_tokens` and `system` fields are ignored).
- **Document isolation:** book text is escaped inside `<document>`, so a PDF can't close the block and add rules (verified).
- **Error messages:** upstream errors are mapped to generic, user-friendly text; details go only to Cloudflare logs.
- **Regular expressions:** all patterns on user or AI text are linear-time; none have nested quantifiers.
- **Server CPU:** 1–2 ms typical, about 6 ms worst case per request (free-plan limit is 10 ms).
