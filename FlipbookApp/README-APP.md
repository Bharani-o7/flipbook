# Flipbook — the real app (iPhone + Android), free

This folder turns Flipbook into a real mobile app:

| | How you run it | Cost | Own app icon? |
|---|---|---|---|
| **Android** | A real `.apk` you install on the phone | **$0 forever** | **Yes** |
| **iPhone** | Through the free **Expo Go** app | **$0** | No — opens inside Expo Go |
| **iPhone, standalone + TestFlight + App Store** | EAS build → TestFlight | **$99/year to Apple** | Yes |

Apple charges $99/year for *any* standalone app on an iPhone (TestFlight included). There is no free way around it, and it has nothing to do with this project. Everything below is free.

You do **not** need a Mac for any of this.

---

## Quick start

`config.js` already points at the live reader, so a fresh clone needs no editing:

```powershell
npm install
npx expo start
```

Scan the QR code with your iPhone **Camera** app. That's the whole setup.

If `npm` isn't recognised, install the **LTS** build of Node.js from
https://nodejs.org first and reopen the terminal.

---

## Step 1 — Run it on your iPhone (free)

1. Install **Expo Go** from the App Store (free).
2. In this folder: `npx expo start`
3. Point the iPhone Camera at the QR code and tap the banner.

**If Expo Go demands you sign in.** Expo Go skips its sign-in check only for
private LAN addresses — `192.168.x.x`, `10.x.x.x`, `172.16–31.x.x`. On a VPN,
a phone hotspot or a carrier-NAT network your laptop gets a `100.x.x.x` address,
which Expo treats as remote and requires a signed-in CLI for. Create a token at
https://expo.dev/settings/access-tokens, then in the window you start Metro from:

```powershell
set EXPO_TOKEN=your_token_here
npx expo start
```

`set` only applies to that one window, so Metro has to be started from it.

Don't bother with `npx expo login` on Windows — it shells out to
`cmd /c start` with an OAuth URL containing `&`, which cmd mangles, and the
command crashes. The token is the reliable route.

**If the QR won't connect at all:** `npx expo start --tunnel` routes through
Expo's servers instead of your network.

**If Expo Go reports an SDK mismatch:** it only runs the SDK version it ships
with. Update Expo Go, or move the project: `npx expo install expo@^58 --fix`

## Step 2 — Build the real Android app (free, your own icon)

1. Free account at https://expo.dev (no card needed).
2. In this folder:
   ```powershell
   npx eas-cli login
   npx eas-cli build --platform android --profile preview
   ```
   Answer **yes** when it offers to create a keystore — Expo stores it for you.
3. The build runs in the cloud (~10–20 minutes on the free queue), then gives
   you a link.
4. Open that link **on the Android phone**, download the `.apk`, tap to install.
   Android asks you to allow installing from this source — normal for apps
   outside the Play Store.

The free Expo plan includes 15 Android and 15 iOS builds a month.

---

## If you forked this project

Point the app at your own copy:

1. Push your fork, then **Settings → Pages → Source: GitHub Actions**. The
   workflow in `.github/workflows/deploy.yml` publishes `Flipbook/` on every
   push to `main`.
2. Set `APP_URL` in `config.js` to `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

Cloudflare Pages works too — create a project with **Direct Upload** and drag
the `Flipbook` folder in. No git involved.

## Developing offline

Serve the reader from your own machine and point the app at it:

```powershell
cd ..\Flipbook
npx serve -l 8080
ipconfig | findstr IPv4
```

Put that address in `config.js`, e.g. `http://192.168.1.42:8080`. Phone and
laptop must be on the same network, and that terminal has to stay open.

The AI is switched off on a plain-http address — browsers only grant the
storage it needs on a secure origin. Everything else works. Point `config.js`
back at the https site to get the AI back.

---

## Later: the iPhone as a standalone app (needs Apple's $99/year)

Nothing here changes except two commands:

```powershell
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios
```

EAS builds iOS in the cloud, so you still don't need a Mac. After that it
appears in TestFlight for your testers.

One honest warning for the App Store: Apple sometimes rejects apps that are
only a wrapper around a website (guideline 4.2, "minimum functionality").
Flipbook does real work on the device — reading PDFs, recognizing scanned
pages, running the AI offline — so make that clear in the review notes. If
Apple pushes back, the fix is to move more of the app native rather than argue.

---

## What's in this folder

```
App.js        The native shell: full-screen web view, loading and offline screens,
              Android back button, status-bar colour that follows the reader's theme
config.js     Which address the reader loads from — already set to the live site
app.json      App name, icon, colours, Android package name
eas.json      Build settings (preview = installable .apk)
assets/       App icon and splash screen
```

## Troubleshooting

| What you see | Fix |
|---|---|
| "Almost there" setup screen | `APP_URL` is empty, or is an `http://` address outside the local ranges |
| Spinner that never finishes | The address isn't reachable. Open it in the phone's browser to check. If it's a local server, confirm that terminal is still running |
| "Can't reach Flipbook" | No internet, or wrong address |
| Expo Go: "not signed in to Expo CLI" | Use `set EXPO_TOKEN=...` — see Step 1 |
| `npx expo login` crashes with a `cmd.exe /c start` error | Windows bug. Use the token instead |
| QR code won't connect | `npx expo start --tunnel` |
| Expo Go: "SDK version mismatch" | Update Expo Go, or `npx expo install expo@^58 --fix` |
| Android won't install the .apk | Allow "install unknown apps" for your browser or Files app |
| Ask AI says it needs an https address | Correct, and not fixable in the page. Use the hosted site |

## Good to know

- The first time you use AI or open a scanned page, the model downloads (a few
  MB for scanned-page reading, 0.6–2.8 GB for Ask AI). Do it on **Wi-Fi**.
  After that it works offline.
- Books, notes and highlights live on the device and aren't shared between your
  phone and laptop.
- Updating the reader is just a push. The workflow redeploys, and the installed
  app picks it up on next launch — no rebuild, no app-store review.
