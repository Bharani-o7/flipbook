// ============================================================
//  Where the app loads the reader from. This already points at the live
//  site, so a fresh clone runs with no edits:
//      npm install && npx expo start
//
//  The workflow in .github/workflows/deploy.yml republishes that address on
//  every push to main, so it is never out of date.
//
//  Change this only if you forked the project (use your own Pages URL) or
//  you are working offline. For offline work, run `npx serve -l 8080` inside
//  the Flipbook folder and put your machine's address here instead:
//      export const APP_URL = 'http://192.168.1.42:8080';
//  Plain http:// is accepted only for local-network addresses, and browsers
//  withhold the storage the AI needs on those, so the AI stays switched off
//  until this points back at an https address.
// ============================================================
export const APP_URL = 'https://bharani-o7.github.io/flipbook/';

// Shown in the app bar area while loading. Cosmetic only.
export const APP_NAME = 'Flipbook';
