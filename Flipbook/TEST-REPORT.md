# Flipbook test report

**Date:** November 7, 2026 · **Result: 671 automated checks passed** (current version, with free on-device AI), including a security review (see SECURITY-REPORT.md), plus install, accessibility and performance audits.

Tests ran in a sandbox with real Chrome (the same Chromium engine used by Android Chrome, Samsung Internet and Microsoft Edge), emulating each device's screen size, pixel density, touch input and browser identity. The app was served the way GitHub Pages serves it, and was also opened straight from disk.

## Devices tested

| Platform | Profile | Checks |
|---|---|---|
| Android | Pixel 7 · Chrome (412×915, 2.6×) | 50/50 |
| Android | Galaxy S23 · Samsung Internet (360×780, 3×) | 50/50 |
| Android | Small budget phone, Android 10 (320×640) | 48/48 |
| Android | Galaxy Z Fold, folded (344×882) | 48/48 |
| Android | Galaxy Tab S9 tablet, portrait + landscape | 50/50 |
| Windows | 1366×768 laptop · Chrome 100% | 49/49 |
| Windows | 1920×1080 · Edge 125% scaling | 49/49 |
| Windows | 1920×1080 · Chrome 150% scaling | 49/49 |
| Windows | 2560×1440 · Edge 150% scaling | 49/49 |
| Windows | Surface touchscreen · Edge (touch + mouse + rotation) | 47/47 |
| Both | Edge-case files, 300-page stress test, input devices, file://, offline | 71/71 |

## What every device profile checked
Opening a PDF; page fits the screen and is sharp at that screen's pixel density; swipe / tap edges / tap middle (touch); mouse wheel, arrow keys, Home/End, edge clicks (desktop); next/prev buttons and slider; contents, thumbnails, search (27/27 matches); bookmarks, page notes, highlights, highlight notes; text mode reflow with no sideways scrolling; text size, themes; Markdown export; read-aloud to the end with automatic page turns; screen rotation; **Android/browser Back button** (closes dialogs and panels, then returns to the library); library, last page and notes surviving a reload; removing a book; zero JavaScript errors.

## Edge cases & stress
- Password-protected, corrupted, and fake (renamed) PDFs → clear message, app keeps working
- Scanned (image-only) PDF → pages display; text mode, search and read-aloud explain there's no text
- Mixed page sizes (portrait, landscape slide, A4, long receipt) → each fits
- Accented text (Café, naïve, Ångström) extracted correctly; line-break hyphens re-joined; two-column layout split into paragraphs
- 300-page book: opens in ~0.5 s, 60-chapter contents, 40 rapid taps land on the exact page, old pages released from memory, full-book search in ~0.5 s, JS heap stays under 15 MB
- Precision touchpad swipe = exactly one page; Firefox-style line-based wheel; Ctrl+F, Esc, T, B shortcuts; keyboard Tab focus; mouse side "Back" button
- Works with **no internet** after the first visit (open saved books, add new PDFs, text mode)

## Audits
| Audit | Mobile | Desktop |
|---|---|---|
| Lighthouse Performance | 100 | 100 |
| Lighthouse Accessibility | 100 | 100 |
| Lighthouse Best Practices | 100 | 100 |
| Lighthouse SEO | 100 | 100 |
| axe-core WCAG 2 AA (all screens, all 3 themes) | 0 issues | 0 issues |
| Chrome install requirements ("Install app" / "Add to Home screen") | Pass | Pass |

## Bugs found and fixed during testing
1. **Android Back button exited the app.** It now closes dialogs, then panels, then returns to the library.
2. **Leaving a book mid-page-flip could save the wrong page.** The new page is now recorded right away.
3. **One wheel notch didn't turn the page** on touchscreen laptops and some smooth-scrolling mice (they report smaller steps). Fixed, while keeping one page per trackpad swipe.
4. **Firefox mouse wheels** report scrolling in lines, not pixels. Now handled.
5. **Esc didn't close search** while typing in the search box.
6. **Short scanned PDFs** said "Finished reading" instead of explaining that there's no text.
7. Accessibility: added page landmarks, made text mode keyboard-scrollable, darkened Sepia's secondary text for contrast, and stopped screen readers from announcing hidden messages.
8. Mobile load speed: first paint went from 3.2 s to 0.8 s on a slow 4G simulation (non-blocking scripts and fonts).

## Ask AI (added November 7, 2026): 106 checks
**AI server (38 checks, run in Cloudflare's real Workers runtime via `wrangler dev`, with a stand-in Claude that speaks the real streaming format):**
- Refuses requests from unknown websites and from scripts with no website; refused requests never reach Claude (no cost)
- Rejects broken, empty, oversized, or page-less requests with clear messages
- Adds the secret key itself; the app can't change the model, answer length, or rules (a fake "You are a pirate" system prompt was ignored)
- Book-only rules, page-citation rules and "book text is data" rules are present; the book is wrapped so a fake `</document>` inside a PDF can't break out
- Prompt caching on the book; chat history always alternates correctly
- Claude's private reasoning is never forwarded; stop reason and token usage are
- Friendly messages for busy AI, bad API key, out of credit, mid-answer failure, cut-off answers
- Rate limit: exactly 10 questions per minute per visitor, then a friendly 429; other visitors unaffected
- Server CPU per question: about 1–2 ms typical, about 6 ms worst case (free plan allows 10 ms)

**Ask AI in the app (68 checks on Android Pixel 7, Windows Edge, a 320px phone):** streaming answers; bold and list formatting; page citations become buttons that jump to the page (and invented pages like [p. 999] stay plain text); whole book sent for short books; for a 300-page book only the matching passages are sent (a "chapter 37" question sent just chapter 37's 6 pages, about 10k characters); "page 222" and "this page" pull in the right pages; follow-up questions carry earlier answers, while failed or stopped turns are left out; Stop button; busy, error and offline messages; "Ask AI" on selected text; chat saved per book and clearable; suggestion chips; scanned PDFs explained with no request sent; setup message when the server isn't connected; wide screens keep the chat beside the page; zero accessibility issues in light and dark themes.

**Bugs found and fixed:** oversized book text was silently cut instead of rejected; failed questions were being re-sent with the next one; big books padded requests with weak matches (now about 10× smaller and more focused); server CPU trimmed to stay under the free-plan limit; citation and "Clear chat" contrast.

## Not covered by this sandbox
- **The real Claude model.** No API key was available here, so answers came from a stand-in. Whether Claude always refuses off-topic questions depends on the model following the server's rules. It follows them very reliably, but try a few off-topic questions after setup.
- **Firefox and Safari engines** couldn't be installed here. The code avoids engine-specific features, and the Firefox wheel difference is handled, but give it a quick manual check.
- **Real speech voices** were replaced with a stand-in engine, so the read-aloud *logic* was tested but not actual audio.
- Emulation reproduces screen size, density, touch and browser identity, but not each phone's exact performance or memory limits.

## Security hardening (24 additional checks)
Server (10): signed answers accepted, edited answers dropped, multi-line titles neutralized, title attribute escaped, 1.2 MB body cap (413), no CORS grant for the `null` origin, case-insensitive origin match, IPv6 /64 shares one limit, daily per-visitor cap enforced (the counter carries over across runs within the same day, as intended), health endpoint minimal.
App (14): markup in PDFs and file names shows as text; zero Content-Security-Policy violations; embedded-font PDF renders without `eval`; very tall and very wide pages visible with bounded canvases; bounded cover sizes; same-name, same-size books kept separate; leaving a book mid-answer stops it and the next book's question works; an error page never replaces the offline copy.

## Final fixes (16 additional checks)
PDF.js upgraded to 6.5.438: all suites rerun and pass, both hosted (real background worker) and opened from disk (main-thread fallback). Bot check: 10 server checks (no session → 401, failed or wrong-site token → 403, valid → signed 12-hour session, session copied to another visitor/altered/oversized → refused) and 6 app checks (invisible check then answer, session reused, automatic re-check, zero policy violations, friendly failure with nothing sent). Fonts bundled: no Google requests; Lighthouse still 100 in all four categories (mobile first paint 0.9 s).

## Free on-device AI (Nov 7, 2026): 64 checks + hardening re-run
The Claude server was removed; Ask AI now runs Hugging Face models (Qwen3 0.6B / Gemma 3 1B / Jan-nano 4B via Transformers.js) on the device. The **real** Transformers.js worker was started in Chrome: it loads, picks the CPU path when no GPU is present, and reports a clear "couldn't download from Hugging Face" message when downloads are blocked (as in this sandbox). Model answers were simulated by a stand-in worker using the exact same message protocol, so everything around the model was tested on Android and Windows profiles: no outside connections before the reader starts the AI; download card, progress bar, ready state; streaming answers; hidden "thinking" text; page-citation buttons; rules and page-labelled passages within the small-model budget; follow-ups carry the last exchange; off-topic questions and greetings handled without running the model; Stop; error messages; Ask AI on selected text; auto-start once downloaded; chat saved per book; model chooser and "Delete downloaded AI models"; 300-page book retrieval (chapter 37) and whole-book sampling for "Summarize"; scanned PDFs; opened-as-file message. Accessibility: 0 issues on the download card, chat (light/dark) and model chooser. Lighthouse 100/100/100/100 on mobile and desktop.

**Bugs found and fixed:** follow-up questions like "Tell me more about point two" were wrongly refused by the book-only gate (now allowed when they build on the last answer); "Summarize this book" on a 60-chapter book only covered the first chapters (now evenly spaced across the whole book); download failures were reported as "device can't run it" (now a clear download/network message).

**Not covered here:** real model downloads and answer quality, because Hugging Face is unreachable from this sandbox. Try it on your devices: expect a one-time 0.6–2.8 GB download.

## Answer check (third layer of the book-only rule): 14 checks
A stand-in model was made to misbehave on purpose. An answer from its own knowledge with no page citation was never shown, not even for a moment while streaming (the screen was watched continuously), and was replaced by the polite refusal. An answer citing a page it was never given was blocked. "I couldn't find that" answers were shown clearly. Real book answers appeared in full once they cited a page. Invented page numbers were removed from otherwise good answers. Blocked answers were never reused as chat history. Readers see "Checking the answer against the book…" while an answer is held back. Pages cited earlier in the same chat count as valid. Passed on Android and Windows profiles, with 0 accessibility issues.

## Reading any file: OCR for scans, images and text (Nov 7, 2026): 19 checks
Tested end-to-end in a real browser, fully offline under the app's strict security policy, on real inputs:
- **Scanned PDF with no text layer** (image-only pages): text mode shows a "reading the text…" placeholder, then the recognized text appears (verified it matched the known page text); search then finds recognized words; recognized text is saved to the book and shown instantly on reopen (41 ms, no re-OCR).
- **Ask AI on a scanned book**: the app recognizes the pages first (cached), then answers with grounded, page-cited text — the model only ever sees the recognized book text.
- **Image file** (PNG with text): opens as a one-page document and its text is recognized.
- **Text file** (.txt): opens with real selectable text and is *not* sent through OCR.
- Proven separately in Node and in-browser: OCR of a rasterized real book page matched the original at 95% confidence (~2 s/page).

**Bug found and fixed:** cached recognized pages loaded into memory but the on-screen section stayed on "Loading…" (a stale-DOM bug that would have affected every reopened scanned book); fixed so cached pages render immediately.

**Honest limits (stated in the app too):** handwriting works only when neat/printed-style; messy cursive is unreliable. Word/EPUB need converting to PDF. Non-English scripts need their Tesseract data file added.
