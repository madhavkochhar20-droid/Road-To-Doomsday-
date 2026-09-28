# The Road to Doomsday

An unofficial fan-made watch guide: every MCU film and Disney+ series in chronological
(in-universe) order, a live countdown to *Avengers: Doomsday* (Dec 18, 2026), and a
personal watch tracker.

Single static page — no build step, no dependencies, no backend.

## Features

- Live countdown to *Avengers: Doomsday*
- In-universe order or release order
- Filter by phase (1–6) or by the X-Men Universe (separate continuity)
- Search, and an "Essential only" filter that hides skippable entries
- Watch tracker: click a title to mark it watched (saved in your browser's `localStorage`)
- "Watch next" highlight, time-left estimate, progress bar, share button, completion milestone
- IMDb rating badge on every entry
- Light / dark / system theme toggle

## Run locally

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy

**GitHub Pages (workflow included)**

1. Push this repo to GitHub on the `main` branch.
2. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` redeploys. The site appears at `https://<username>.github.io/<repo>/`.

**Netlify / Vercel / Cloudflare Pages** — import the repo (or drag the folder in).
Framework preset: *None / Static*. No build command, publish directory is the repo root.

## Editing the content

Everything lives in `index.html`:

- **Titles, order, ratings, runtimes** — the `MOVIES` array in the `<script>` block.
  Each entry has `p` (phase, 7 = X-Men), `i` (unique id — never reuse or renumber it,
  watch progress is stored against it), `y` (in-story year label), `ry` (release year),
  `rt` (runtime in minutes), `sk` (skippable), `imdb` (rating, `null` = not released).
  Chronological order follows `i`, except X-Men entries, which are pinned to the top.
- **Countdown date** — `const target = new Date("2026-12-18T00:00:00")`.
- **Background image** — `assets/throne-bg.jpg`, styled by `.throne-bg`.

## Notes

- IMDb ratings are a snapshot taken when the site was built. Ratings for recent releases
  move around, so refresh them occasionally.
- Placement of time-jumping stories and where the Disney+ series slot in follows the most
  common fan reading, not an official studio timeline. Animated anthology titles
  (e.g. *What If…?*) are intentionally left out.
- Fonts (Big Shoulders Display, IBM Plex Sans) load from Google Fonts.

## Disclaimer

This is an unofficial fan project. It is not affiliated with, endorsed by, or sponsored by
Marvel, Disney, or IMDb. All titles and trademarks belong to their respective owners.
The background image was supplied by the project owner — make sure you have the right to
publish it before deploying publicly.
