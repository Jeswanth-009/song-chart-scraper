# API Guide

Base URL: `http://localhost:3000`

The scraper starts from the main site and key sections (`/`, `/ww/`, `/itunes/`, `/charts/`, `/spotify/`, `/youtube/`, `/youtube/trending.html`) by default; adjust via `SCRAPE_SEEDS` if you need more or fewer entry points.

## New endpoints

- `GET /stats` — summary of scrape (pages, tables, rows, timestamps).
- `GET /pages/:slug/tables` — list tables for a page with row counts and headers.
- `GET /pages/:slug/tables/:index` — fetch a specific table by index for a page.
- `GET /pages/search?q=term[&limit=50]` — search pages by title/url.
- `GET /tables/headers` — list unique headers across all tables with counts.
- `GET /tables/search?q=term[&header=Name][&limit=50]` — search rows across all tables; optional exact header match narrows to a column.
- `GET /tables/top?header=Views[&limit=50]` — numeric sort across rows for a header (strips non-numeric characters).
- `GET /tables/distinct?header=Artist%20and%20Title[&limit=100]` — frequency counts for unique values in a column.
- `GET /links` — all unique links discovered during crawl.

### Preset chart endpoints

- `GET /charts/apple-music/worldwide` — Worldwide Apple Music Song Chart tables.
- `GET /charts/youtube/trending/worldwide` — YouTube trending worldwide music video tables.
- `GET /charts/spotify?country=Global&period=Daily` — Spotify chart tables; `country` and `period` are hints for matching. Falls back to the main Spotify Charts page if no exact match.

## Endpoints

### GET /health
Returns status and timestamp of the last successful scrape.

**Response**
```json
{ "status": "ok", "lastUpdated": "2025-12-10T03:00:00Z" }
```

### GET /charts
Returns the primary chart tables from the root page.

**Response**
```json
{
  "source": "https://kworb.net/ww/",
  "updatedAt": "2025-12-10T03:00:00Z",
  "pageTitle": "Worldwide iTunes Song Chart",
  "tables": [
    {
      "caption": "",
      "headers": ["Pos", "Artist and Title", "Days", "Pk (x?)", "Pts"],
      "rows": [["1", "BTS - Anpanman", "24", "1", "21376"], ["2", "HUNTR/X, EJA...", "132", "1", "18382"]]
    }
  ]
}
```

### GET /pages
Lists all scraped pages with metadata.

**Response**
```json
[
  {"url": "https://kworb.net/ww/", "title": "Worldwide iTunes Song Chart", "slug": "ww", "tables": 1, "fetchedAt": "..."},
  {"url": "https://kworb.net/itunes/artist.html", "title": "Artists", "slug": "itunes-artist-html", "tables": 3, "fetchedAt": "..."}
]
```

### GET /pages/:slug
Returns the full scraped content for a specific page.

**Example** `GET /pages/itunes-artist-html`

**Response**
```json
{
  "url": "https://kworb.net/itunes/artist.html",
  "title": "Artists",
  "tables": [ { "headers": ["Pos", "Artist"], "rows": [["1", "Taylor Swift"], ...] } ],
  "links": ["https://kworb.net/itunes/artist/taylorswift.html", ...],
  "fetchedAt": "..."
}
```

### POST /scrape
Triggers a fresh scrape and cache write. Protect this endpoint (API key/IP allow-list) in production.

**Response**
```json
{ "status": "ok", "pages": 64, "updatedAt": "2025-12-10T03:00:00Z" }
```

## Common flows

1) **Sync latest data into your app**
   - Call `GET /charts` for the main worldwide table.
   - Call `GET /pages` to discover other scraped endpoints; fetch the ones you need.

2) **Trigger a refresh manually**
   - Send `POST /scrape` (use a secret header) and wait for `status: ok`.

3) **Paginate client-side**
   - Tables already include headers and rows; paginate or filter in your UI/mobile app.

4) **Schedule daily refresh on Vercel**
   - Add a Vercel Cron hitting `POST /scrape` at your preferred time.
   - Persist data in Vercel KV/Postgres; adapt `storage/localStore.ts` to store there.
