# Kworb Worldwide Chart Scraper

Scrapes [kworb.net/ww](https://kworb.net/ww/) (and linked pages on the same host), caches the results locally, and serves them through a lightweight API. Includes a cron-based runner for daily updates. Storage is GitHub-first, so data lives in your repo with no payment info required.

## Quick start

```bash
npm install
npm run scrape   # one-off scrape + write data/kworb.json
npm run serve    # start API server on port 3000
```

## Configuration

Environment variables (optional):

- `SCRAPE_BASE_URL` (default: https://kworb.net/) — host used for same-domain filtering.
- `SCRAPE_SEEDS` (comma list; default seeds: `/`, `/ww/`, `/itunes/`, `/charts/`, `/spotify/`, `/youtube/`, `/youtube/trending.html`) — crawl starts here.
- `SCRAPE_MAX_PAGES` (default: 20) — higher value walks more internal links.
- `SCRAPE_FETCH_DELAY_MS` (default: 800) — politeness delay between requests.
- `SCRAPE_USER_AGENT` (default: friendly bot UA)
- `SCRAPE_CRON` (default: `0 3 * * *`) — 03:00 daily.
- `SCRAPE_DATA_FILE` (default: `data/kworb.json`)
- `PORT` (default: 3000)
- **GitHub storage (no card):** Set `GITHUB_TOKEN` (repo contents scope), `GITHUB_REPO` (owner/repo). Optional: `GITHUB_BRANCH` (default `main`), `GITHUB_PATH` (default `data/kworb.json`). When set, scraper/API read/write the file in that repo. This is the default path for automation.

## Commands

- `npm run scrape` — fetch + cache.
- `npm run serve` — start API.
- `npm run schedule` — start background cron that runs according to `SCRAPE_CRON`.

## API

- `GET /health` — status + lastUpdated.
- `GET /charts` — primary root page tables (Worldwide iTunes Song Chart etc.).
- `GET /pages` — list all scraped pages with slugs and counts.
- `GET /pages/:slug` — full data for a specific scraped page.
- `POST /scrape` — trigger a fresh scrape and update cache (protect behind auth when deploying).

Slugs derive from the page URL path (e.g., `https://kworb.net/ww/` → `ww`).

## Deployment + automation tips

- **GitHub-only flow (no card):** GitHub Actions nightly cron (see `.github/workflows/scrape.yml`) runs `npm run scrape` and commits `data/kworb.json` to the repo using the workflow token. API reads directly from the same repo via `GITHUB_TOKEN` + `GITHUB_REPO` envs.
- **Server/hosted API:** Deploy `npm run serve` (or serverless handler) and set `GITHUB_TOKEN`, `GITHUB_REPO`, and optionally `GITHUB_BRANCH`/`GITHUB_PATH`. The API will fetch the latest JSON from GitHub at startup.
- **Local dev:** Without GitHub envs, data is stored locally at `SCRAPE_DATA_FILE`.

## Data shape

`data/kworb.json` contains:

```json
{
  "source": "https://kworb.net/ww/",
  "startedAt": "...",
  "finishedAt": "...",
  "lastUpdated": "...",
  "pages": [
    {
      "url": "https://kworb.net/ww/",
      "title": "Worldwide iTunes Song Chart",
      "tables": [
        {"caption": "...", "headers": ["Pos", "Artist and Title", ...], "rows": [["1", "BTS - Anpanman", ...]]}
      ],
      "links": ["https://kworb.net/itunes/...", ...],
      "fetchedAt": "..."
    }
  ]
}
```

## Notes

- The crawler only follows links on `kworb.net` and respects `SCRAPE_MAX_PAGES` to avoid hammering the site; increase it if you want deeper coverage.
- Add authentication or an allow-list in front of `POST /scrape` before exposing publicly.
- If you need richer parsing (e.g., section labels), extend `extractTables` in `src/utils/parse.ts`.
