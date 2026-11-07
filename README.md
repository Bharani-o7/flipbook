# Flipbook

Turn any PDF into an interactive ebook — page flip, reflowable text, highlights,
notes, search, read-aloud, OCR for scans and handwriting, and an AI that answers
questions about the book you have open and nothing else.

Everything runs on your device. No account, no server, no API key, no usage
limits. Books never leave the machine they are opened on.

**Read it now:** https://bharani-o7.github.io/flipbook/

Works in any modern browser on Windows, macOS, Linux, iPhone, iPad and Android.
Your browser's *Install app* / *Add to Home Screen* option makes it a real app
with its own icon, and it keeps working offline after the first visit.

## Running the phone app

The native shell is a thin wrapper that loads the live site above, so a fresh
clone needs no configuration:

```bash
git clone https://github.com/Bharani-o7/flipbook
cd flipbook/FlipbookApp
npm install
npx expo start
```

Scan the QR code with your iPhone's Camera app to open it in
[Expo Go](https://expo.dev/go) (free), or press `a` for an Android emulator.

For a standalone Android APK you can install and share:

```bash
npx eas build -p android --profile preview
```

A standalone iPhone app, rather than one running inside Expo Go, requires an
Apple Developer account at $99/year. That is Apple's rule, not a limit of this
project.

## What is in here

| Folder | What it is |
| --- | --- |
| `Flipbook/` | The reader. Plain HTML, CSS and JavaScript with no build step. This is what gets published. |
| `FlipbookApp/` | The native shell (Expo / React Native) for the Android APK and the iPhone app. |
| `.github/workflows/` | Publishes `Flipbook/` to GitHub Pages on every push to `main`. |

No build, bundler or package install is needed for the reader itself — open
`Flipbook/index.html` in a browser and it runs. The AI is the one exception: it
needs an `https` address or `localhost`, because browsers only grant the storage
it uses on a secure origin.

## Working on it

Edit files in `Flipbook/` and push. The workflow redeploys within a minute and
the phone app picks up the change on its next launch — no rebuild.

To develop with no internet, serve the folder locally and point the shell at it:

```bash
cd Flipbook
npx serve -l 8080
```

Then set `APP_URL` in `FlipbookApp/config.js` to your machine's address
(`ipconfig` on Windows, `ifconfig` elsewhere), e.g. `http://192.168.1.42:8080`.
Your phone and computer must be on the same network. The AI stays disabled on a
plain-http address; everything else works.

After changing anything in `Flipbook/`, bump `VERSION` in `Flipbook/sw.js` so
returning visitors get the new files instead of the cached ones.

## Privacy and security

- Books, notes, highlights and AI models are stored on the device only.
- No analytics, no tracking, no network calls except downloading the AI model
  from Hugging Face the first time you use it.
- A strict Content-Security-Policy is set in `index.html`; `SECURITY-REPORT.md`
  in `Flipbook/` documents the threat model and what was tested.

## Credits

Built on [PDF.js](https://mozilla.github.io/pdf.js/),
[Transformers.js](https://huggingface.co/docs/transformers.js),
[Tesseract.js](https://tesseract.projectnaptha.com/) and
[pdf-lib](https://pdf-lib.js.org/). Licences for each are in their folders under
`Flipbook/vendor/`.
