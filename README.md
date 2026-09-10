# 🎵 Music Playlist Checker

Compare a Spotify playlist export against your local music library and see
exactly which tracks you're missing — no uploads, no accounts, no server.
Everything runs entirely in your browser.

## Features

- **Fuzzy matching** — matches playlist tracks to local files even when
  filenames don't exactly match the Spotify title (missing punctuation,
  stripped "(feat. ...)" tags, soundtrack/compilation titles, track numbers
  in filenames, etc.)
- **Three-way results** — tracks are sorted into **Found**, **Possible**
  (needs a quick manual check), and **Missing**
- **Spotify links** — every unresolved track gets a one-click link straight
  to the exact song on Spotify (using the Track URI/ID if your CSV export
  includes one, or a search link otherwise)
- **CSV export** — download your missing tracks, or the full results, as CSV
- **Progress bar** — live progress while scanning large libraries
- **Saved sessions** — your last scan's results are remembered locally, so
  reopening the app doesn't mean starting from scratch
- **100% local** — your music files are never uploaded anywhere; only
  filenames are read, in-browser, via the File System Access API

## Getting started

### Option 1 — just open it

Clone the repo and open `index.html` directly in your browser:

```bash
git clone https://github.com/YOUR_USERNAME/music-playlist-checker.git
cd music-playlist-checker
open index.html   # or double-click the file
```

### Option 2 — run a local server (recommended)

Some browsers restrict certain features when opening HTML files directly
from disk (`file://`). A local server avoids that:

```bash
npm start
```

This runs `npx serve .` and opens the app at `http://localhost:3000`.

> **Browser support:** the folder picker relies on `webkitdirectory`, which
> only works in **Chromium-based browsers** (Chrome, Edge, Brave, Opera).
> Firefox and Safari don't support selecting a whole folder.

## How to use it

1. **Export your Spotify playlist to CSV.** Spotify's own export gives you
   track name/artist/album, but no direct song links. For exact Spotify
   links in your results (instead of search links), use
   [Exportify](https://exportify.net), which includes the Track URI.
2. Click **Choose CSV** and select the export.
3. Click **Choose folder** and select your local music folder.
4. Click **Scan library**.
5. Review the **Found / Possible / Missing** counts and the results table.
6. Use the **Spotify Link** button on any unresolved track to open it
   directly on Spotify.
7. Export **Missing CSV** or **All results** if you want a copy outside the
   app.

## How matching works

Each playlist track is compared against every local filename using a mix of:

- Exact and near-exact string matching after normalizing punctuation,
  casing, and featured-artist notation
- Track-number and metadata-tag stripping (`03 - Song.mp3`,
  `Song (Remastered 2011).flac`)
- A title-only variant for compilation/soundtrack-style Spotify entries
  (e.g. `Song (with X) - From Movie Soundtrack` → matches a file just named
  `Song.mp3`)
- Edit-distance (Levenshtein) similarity and word-overlap scoring, combined
  into a single confidence score

Tracks scoring ≥92% are marked **Found**, ≥78% are marked **Possible**, and
anything lower is **Missing**.

## Project structure

```
.
├── index.html              # App shell/markup
├── style.css                # Styling
├── app.js                   # All app logic (parsing, matching, scanning, UI)
├── .github/workflows/       # GitHub Actions — auto-deploy to GitHub Pages
├── package.json
├── LICENSE
└── README.md
```

## Deployment

This repo includes a GitHub Actions workflow that deploys the site to
**GitHub Pages** automatically on every push to `main`. To enable it:

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push to `main` (or re-run the workflow) — your app will be live at
   `https://YOUR_USERNAME.github.io/music-playlist-checker/`.

## Roadmap ideas

- Manual override / confirm for "Possible" matches
- Support for other export formats (Apple Music, YouTube Music)
- Batch actions across multiple missing tracks

Contributions and issues welcome.

## Privacy

Your Spotify CSV and music folder are processed entirely client-side. No
files are uploaded to any server. The only network requests this app makes
are the links you click to open Spotify.

## License

[MIT](LICENSE)
