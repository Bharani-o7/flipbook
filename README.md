# Flipbook: PDF to interactive ebook

**Read it now: https://bharani-o7.github.io/flipbook/**

Flipbook turns any PDF into an interactive ebook in your browser. It runs on **iPhone, iPad, Mac, Windows and Android**, and you can install it to your home screen or Dock like a native app. There's no server and no account, and your books never leave your device.

## Features

- **Page mode:** realistic page-flip animation. Swipe, tap the edges, use a two-finger trackpad swipe, or press the arrow keys.
- **Text mode:** turns the PDF into reflowable text with adjustable size and a serif/sans font choice.
- **Highlights & notes:** select text to highlight it or attach a note; add a note to any page; bookmark pages.
- **Ask AI (free, no limits):** ask anything about the open book and get answers drawn only from it, with tappable page citations. Off-topic questions are politely refused. It runs a free Hugging Face model **on the reader's own device**: no server, no account, no API key, no daily limits, and the book never leaves the device.
- **Reads scanned PDFs & images (OCR):** pages with no text layer, photos of pages, and image files are recognized on-device with Tesseract (English bundled, works offline). This feeds text mode, search and Ask AI automatically.
- **Opens images and text files:** PNG/JPG/WebP/etc. and .txt/.md, not just PDFs — each is wrapped into a readable document.
- **Read aloud:** text-to-speech that follows along paragraph by paragraph and turns pages for you (0.75×–2× speed).
- **Navigation:** built-in table of contents, page thumbnails, and full-text search.
- **Library:** remembers your books, where you stopped, and your notes (saved in the browser with IndexedDB).
- **Themes:** Light, Sepia and Dark.
- **Offline:** after the first visit it works without internet (service worker plus a bundled copy of PDF.js).
- **Export:** copies all your bookmarks, notes and highlights as Markdown.

## Tested
671 automated checks: 5 Android and 5 Windows device profiles, edge-case files, a 300-page stress test, offline mode, security hardening, and the on-device Ask AI end to end. Lighthouse scored 100 in all four categories on mobile and desktop. See [TEST-REPORT.md](Flipbook/TEST-REPORT.md) and the security review in [SECURITY-REPORT.md](Flipbook/SECURITY-REPORT.md).

## How Ask AI works
Nothing to set up. A reader taps ✦ and chooses **Download & start** once; the model downloads from Hugging Face, is saved in the browser, and from then on works offline.

| Model (from Hugging Face) | Download | Picked automatically for |
|---|---|---|
| `onnx-community/Qwen3-0.6B-ONNX` (Fast) | about 0.6 GB | devices without a supported graphics chip |
| `onnx-community/gemma-3-1b-it-ONNX` (Balanced) | about 1 GB | phones, tablets, most laptops |
| `onnx-community/Jan-nano-ONNX` (Smartest, Qwen3 4B) | about 2.8 GB | strong computers |

Readers can switch models or delete downloaded ones from the chat footer (**Change**). It runs on the graphics chip through WebGPU (Chrome/Edge, Android 12+, Safari on iOS/iPadOS/macOS 26+) and falls back to the processor elsewhere, more slowly. The app finds the passages that best match each question (or samples every chapter for "summarize" questions) and gives only those to the model. The book-only rule has three layers: (1) questions that share no words with the book (and aren't follow-ups) are refused before the model runs; (2) the model is told to answer only from the passages and cite pages; (3) an answer is shown only once it cites a page from the passages it was given, so an off-topic answer from the model's own knowledge is never displayed, not even while it's being written.

To use different models, edit `MODELS` at the top of `Flipbook/ai-engine.js` (any Transformers.js text-generation model from https://huggingface.co/models?library=transformers.js works).

Small on-device models are good at finding and explaining what's in the book, but they're not as sharp as big cloud AIs and can make mistakes, which is why every answer cites pages.

## The phone app

`FlipbookApp/` wraps the reader in a native shell, so it installs as a real app with its own icon. `config.js` already points at the live site, so a fresh clone needs no configuration:

```bash
git clone https://github.com/Bharani-o7/flipbook
cd flipbook/FlipbookApp
npm install
npx expo start
```

Scan the QR code with your iPhone's Camera app to open it in [Expo Go](https://expo.dev/go) (free), or press `a` for an Android emulator. For a standalone Android APK you can install and share:

```bash
npx eas build -p android --profile preview
```

A standalone iPhone app, rather than one running inside Expo Go, needs an Apple Developer account at $99/year. That's Apple's rule, not a limit of this project. Full instructions and troubleshooting: [FlipbookApp/README-APP.md](FlipbookApp/README-APP.md).

## Hosting it yourself

### Already set up: GitHub Pages
`.github/workflows/deploy.yml` publishes `Flipbook/` on every push to `main`. Nothing to run — push, and the live site has your changes about a minute later. If you fork this, go to **Settings → Pages** and set **Source: GitHub Actions**.

### Cloudflare Pages (gives Flipbook its own web address)
On GitHub Pages every repo you own shares one web address (`your-username.github.io`), which means **any other site you publish there could read Flipbook's saved books** — they're on the same browser origin. Cloudflare Pages gives Flipbook an address of its own. Install Node.js LTS from https://nodejs.org, then from the repo root:

```powershell
robocopy Flipbook ..\flipbook-site /E /XD .git /XF *.md .gitignore
npx wrangler pages deploy ..\flipbook-site --project-name flipbook
```

The first time, `wrangler` asks you to sign in to a free Cloudflare account. Your app is then live at `https://flipbook.pages.dev` (or a similar name). The `robocopy` step copies only the app files.

### On your own computer
- **Quickest:** double-click `Flipbook/index.html`. Everything works except offline caching, installing, and Ask AI (browsers only give AI models the storage they need on a secure address).
- **Full features (local server):** inside the `Flipbook` folder run either of these:
  - macOS / Linux: `python3 -m http.server 8000`
  - Windows: `py -m http.server 8000`

  Then open http://localhost:8000.

## Install it like an app

| Device | How |
|---|---|
| iPhone / iPad (Safari) | Share → **Add to Home Screen** |
| Mac (Safari 17+, macOS Sonoma or later) | **File → Add to Dock** |
| Mac / Windows (Chrome or Edge) | Install icon in the address bar, or the **Install Flipbook** button on the home screen |
| Android (Chrome) | ⋮ menu → **Install app** |

When installed with Chrome or Edge on Mac or Windows, you can also right-click a PDF and choose **Open with → Flipbook**.

## Keyboard shortcuts (Mac & PC)

| Key | Action |
|---|---|
| → / Space / PageDown | Next page |
| ← / PageUp | Previous page |
| Home / End | First / last page |
| T | Switch between page mode and text mode |
| B | Bookmark the current page |
| A | Ask AI about the book |
| ⌘F (Mac) / Ctrl+F (Windows) | Search the book |
| Esc | Close panels |

## Project structure

```
Flipbook/                 The reader — plain HTML, CSS and JS, no build step. This is what gets published.
  index.html              App layout
  styles.css              All styles (themes, layout, animations)
  app.js                  All app logic
  ai-engine.js            Ask AI engine: picks, downloads and runs the Hugging Face model
  ocr-engine.js           OCR engine: recognizes text on scanned pages and images
  sw.js                   Service worker (offline support)
  manifest.webmanifest    Install info (name, icons, PDF file handler)
  icons/                  App icons and favicons
  fonts/                  Inter, Literata, Fraunces (SIL Open Font License), bundled so nothing loads from other sites
  vendor/pdfjs/           PDF.js 6.5.438 by Mozilla (Apache-2.0), which reads and renders PDFs (plus fonts, CJK maps, image decoders)
  vendor/transformers/    Transformers.js 4.3.2 (Hugging Face, Apache-2.0) + ONNX Runtime Web (Microsoft, MIT): runs the AI model
  vendor/tesseract/       Tesseract.js 7 (Apache-2.0) + English data: on-device text recognition
  vendor/pdf-lib/         pdf-lib 1.17 (MIT): wraps images and text files into a readable PDF (loaded only when needed)
  .nojekyll               Tells GitHub Pages to serve the files as-is
FlipbookApp/              The native shell (Expo / React Native) for the Android APK and the iPhone app
.github/workflows/        Publishes Flipbook/ to GitHub Pages on every push to main
```

## Updating the app
Edit files in `Flipbook/` and push — the workflow redeploys and the installed app picks up the change on its next launch, with no rebuild and no app-store review. After changing any file, open `Flipbook/sw.js` and bump `VERSION` (e.g. `flipbook-v12` → `flipbook-v13`) so installed copies fetch the new files instead of the cached ones.

## Limitations
- **Scanned PDFs** (photos of pages) display fine in page mode, but have no text for text mode, search or read-aloud until OCR has run.
- **Password-protected PDFs** aren't supported.
- Data lives in each browser separately: books added on your iPhone won't appear on your Mac.
- Ask AI needs one download per device (0.6–2.8 GB) and enough memory; very old phones may only manage the Fast model.
- **Ask AI needs an `https` address.** Browsers only grant the storage it uses on a secure origin, so it stays switched off on a plain `http://` local address or a file opened from disk.
- **OCR of scanned pages is about 1–3 seconds per page** (done once per page, then cached). A fully scanned book is recognized the first time you read or ask about it.
- **Handwriting:** neat, printed-style handwriting is read reasonably well; messy or cursive handwriting is unreliable — a limit of free on-device OCR.
- **Other languages:** English recognition is bundled. For other scripts, drop the matching `<code>.traineddata.gz` into `Flipbook/vendor/tesseract/` (codes are listed in `ocr-engine.js`).
- **Word/EPUB files** aren't opened directly yet — export them to PDF first.
- On iPhone/iPad, Safari may clear saved data from sites you haven't opened in about 7 days. Adding Flipbook to your Home Screen avoids this.

## Credits
PDF rendering by [PDF.js](https://github.com/mozilla/pdf.js) 6.5 (Mozilla, Apache License 2.0; license in `Flipbook/vendor/pdfjs/LICENSE`). Scanned-page and image text recognition by [Tesseract.js](https://github.com/naptha/tesseract.js) (Apache 2.0). Image/text file wrapping by [pdf-lib](https://github.com/Hopding/pdf-lib) (MIT). Ask AI by [Transformers.js](https://github.com/huggingface/transformers.js) (Hugging Face, Apache 2.0) and ONNX Runtime Web (Microsoft, MIT); models from Hugging Face under their own licenses (Qwen3: Apache 2.0; Gemma 3: Gemma Terms of Use; Jan-nano: Apache 2.0). Fonts: Inter, Literata and Fraunces via Fontsource (SIL Open Font License; licenses in `Flipbook/fonts/`).
