# The Road to Doomsday

An unofficial fan-made watch guide: every MCU film and Disney+ series in chronological
(in-universe) order, a live countdown to *Avengers: Doomsday* (Dec 18, 2026), and a
personal watch tracker. Includes a separate "X-Men Universe" section for the original
Fox X-Men films, kept distinct from the main 616 continuity.

Single static page — no build step. Optional Google sign-in + cloud sync uses Firebase (see below).

## Run locally

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
```

## Deploy

Currently deployed on **Render** (Static Site, auto-deploys from this repo's `main` branch).
A GitHub Pages workflow is also included (`.github/workflows/pages.yml`) as a free backup —
enable it under Settings → Pages → Source: GitHub Actions.

## Google sign-in & saved progress (Firebase)

Signed-in users get their watch progress saved to their Google account (Firestore doc `users/{uid}`),
so it survives logout/login and syncs across devices. Guests still use `localStorage`; whatever a guest
watched is merged into the account on first sign-in.

One-time setup (free Spark plan is enough):

1. [Firebase console](https://console.firebase.google.com) → **Add project**.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.**
3. **Authentication → Settings → Authorized domains** → add your live domain (e.g. `your-site.onrender.com`). `localhost` is there by default.
4. **Build → Firestore Database → Create database** (production mode), then **Rules** tab → paste the contents of `firestore.rules` → **Publish**.
5. **Project settings → Your apps → Web (`</>`)** → register app → copy the config values into `firebase-config.js`.
6. Commit and redeploy.

Until `firebase-config.js` is filled in, the Sign in button shows a "not set up yet" message and the site works as before.

## Character themes & profiles

Tap the profile chip in the header to open the Disney+-style "Who's watching?" screen. Each profile
(up to 5) has its own name, character avatar and watch progress. The avatar's character is also the
interface theme (Spider-Man, Iron Man, Black Panther, Thor, Captain America, Hulk): palette, background
pattern, hero tagline, favicon and the emoji burst all change. Add more themes in the `THEMES` object.
Profiles are stored in `localStorage` (`doomsday-profiles`) and synced to Firestore when signed in.
**After updating, re-publish `firestore.rules`** (it now allows a `profiles` list).

## Where to watch

Every title has a small **Where to watch** button. It detects the visitor's country (saved choice, then an
IP lookup via geojs.io on first click, then browser language) and lets them change it from a dropdown.

- With a TMDB key in `tmdb-config.js` (`window.TMDB_KEY`): shows the streaming / free / rent / buy services for that
  country inside the app (data by JustWatch via TMDB, cached 24h in `localStorage`).
- Without a key (or if TMDB is unreachable; it is blocked on some Indian ISPs): the popup shows a short built-in hint
  (e.g. JioHotstar in India, Disney+ in most other countries; see `hintHTML`) and the button opens the title's JustWatch
  search for that country. Update the hint rules in `hintHTML` if streaming rights change.

## Editing content

Everything lives in `index.html`, inside the `MOVIES` array in the `<script>` block.
Each entry: `p` (phase, 7 = X-Men), `i` (unique id — don't renumber, watch progress is
keyed on it), `y` (in-story year label), `ry` (release year), `rt` (runtime minutes),
`sk` (skippable), `imdb` (rating, `null` = not yet released).

Intro splash: markup `#intro`, styles under "Intro splash" in the `<style>` block; length is set by the `intro-out` animation delay and the `setTimeout` at the bottom of the main script.

Countdown target: `const target = new Date("2026-12-18T00:00:00")`.
Background image: `assets/throne-bg.jpg`.

## Disclaimer

Unofficial fan project. Not affiliated with Marvel, Disney, or IMDb. This product uses the TMDB API but is not endorsed or certified by TMDB.
