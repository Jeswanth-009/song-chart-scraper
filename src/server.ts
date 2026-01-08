import express from "express";
import { config } from "./config.js";
import { scrapeKworb } from "./scraper/kworbScraper.js";
import { loadCache, saveCache } from "./storage/store.js";
import { StorePayload } from "./types.js";

const app = express();
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "Kworb scraper API",
    endpoints: [
      "/health",
      "/charts",
      "/pages",
      "/pages/:slug",
      "/stats",
      "/charts/apple-music/worldwide",
      "/charts/youtube/trending/worldwide",
      "/charts/spotify",
    ],
  });
});

const slugFromUrl = (url: string) => {
  try {
    const { pathname } = new URL(url);
    return pathname.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "root";
  } catch {
    return "unknown";
  }
};

let cache: StorePayload | null = await loadCache();

const ensureCache = () => {
  if (!cache || cache.pages.length === 0) {
    return null;
  }
  return cache;
};

const findPageByTitleOrUrl = (needle: string): StorePayload["pages"][number] | null => {
  const c = ensureCache();
  if (!c) return null;
  const q = needle.toLowerCase();
  return (
    c.pages.find((p) => p.title.toLowerCase().includes(q)) ||
    c.pages.find((p) => p.url.toLowerCase().includes(q)) ||
    null
  );
};

app.get("/health", (_req, res) => {
  res.json({ status: "ok", lastUpdated: cache?.lastUpdated ?? null });
});

app.get("/charts", (_req, res) => {
  if (!cache || cache.pages.length === 0) {
    return res.status(404).json({ error: "No data scraped yet" });
  }
  const root = cache.pages[0];
  res.json({
    source: cache.source,
    updatedAt: cache.lastUpdated,
    pageTitle: root.title,
    tables: root.tables,
  });
});

app.get("/pages", (_req, res) => {
  if (!cache) return res.json([]);
  const list = cache.pages.map((p) => ({
    url: p.url,
    title: p.title,
    slug: slugFromUrl(p.url),
    tables: p.tables.length,
    fetchedAt: p.fetchedAt,
  }));
  res.json(list);
});

app.get("/pages/:slug", (req, res) => {
  if (!cache) return res.status(404).json({ error: "No data scraped yet" });
  const { slug } = req.params;
  const page = cache.pages.find((p) => slugFromUrl(p.url) === slug);
  if (!page) return res.status(404).json({ error: "Page not found" });
  res.json(page);
});

app.get("/stats", (_req, res) => {
  const c = ensureCache();
  if (!c) return res.status(404).json({ error: "No data scraped yet" });
  const totalTables = c.pages.reduce((sum, p) => sum + p.tables.length, 0);
  const totalRows = c.pages.reduce(
    (sum, p) => sum + p.tables.reduce((ts, t) => ts + t.rows.length, 0),
    0
  );
  res.json({
    source: c.source,
    startedAt: c.startedAt,
    finishedAt: c.finishedAt,
    lastUpdated: c.lastUpdated,
    pages: c.pages.length,
    tables: totalTables,
    rows: totalRows,
  });
});

app.get("/pages/:slug/tables", (req, res) => {
  const c = ensureCache();
  if (!c) return res.status(404).json({ error: "No data scraped yet" });
  const { slug } = req.params;
  const page = c.pages.find((p) => slugFromUrl(p.url) === slug);
  if (!page) return res.status(404).json({ error: "Page not found" });
  const tables = page.tables.map((t, idx) => ({
    index: idx,
    caption: t.caption ?? null,
    headers: t.headers,
    rows: t.rows.length,
  }));
  res.json({ url: page.url, title: page.title, tables });
});

app.get("/pages/:slug/tables/:index", (req, res) => {
  const c = ensureCache();
  if (!c) return res.status(404).json({ error: "No data scraped yet" });
  const { slug } = req.params;
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0) return res.status(400).json({ error: "Bad index" });
  const page = c.pages.find((p) => slugFromUrl(p.url) === slug);
  if (!page) return res.status(404).json({ error: "Page not found" });
  const table = page.tables[index];
  if (!table) return res.status(404).json({ error: "Table not found" });
  res.json({ page: { url: page.url, title: page.title, slug }, table });
});

app.get("/tables/headers", (_req, res) => {
  const c = ensureCache();
  if (!c) return res.status(404).json({ error: "No data scraped yet" });
  const counts = new Map<string, number>();
  c.pages.forEach((p) =>
    p.tables.forEach((t) => {
      t.headers.forEach((h) => counts.set(h, (counts.get(h) ?? 0) + 1));
    })
  );
  const result = Array.from(counts.entries()).map(([header, count]) => ({ header, count }));
  res.json(result);
});

app.get("/tables/search", (req, res) => {
  const c = ensureCache();
  if (!c) return res.status(404).json({ error: "No data scraped yet" });
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.status(400).json({ error: "q is required" });
  const headerFilter = req.query.header ? String(req.query.header).toLowerCase() : null;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const results: unknown[] = [];

  outer: for (const page of c.pages) {
    const pageSlug = slugFromUrl(page.url);
    for (let ti = 0; ti < page.tables.length; ti++) {
      const table = page.tables[ti];
      const headerIndex = headerFilter
        ? table.headers.findIndex((h) => h.toLowerCase() === headerFilter)
        : -1;
      for (let ri = 0; ri < table.rows.length; ri++) {
        const row = table.rows[ri];
        const haystack = headerFilter && headerIndex >= 0 ? row[headerIndex] : row.join(" ");
        if (haystack && haystack.toLowerCase().includes(q.toLowerCase())) {
          results.push({
            page: { url: page.url, title: page.title, slug: pageSlug },
            tableIndex: ti,
            rowIndex: ri,
            headers: table.headers,
            row,
          });
          if (results.length >= limit) break outer;
        }
      }
    }
  }

  res.json({ q, count: results.length, results });
});

app.get("/pages/search", (req, res) => {
  const c = ensureCache();
  if (!c) return res.status(404).json({ error: "No data scraped yet" });
  const q = String(req.query.q ?? "").trim().toLowerCase();
  if (!q) return res.status(400).json({ error: "q is required" });
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const results = c.pages
    .filter((p) => p.title.toLowerCase().includes(q) || p.url.toLowerCase().includes(q))
    .slice(0, limit)
    .map((p) => ({ url: p.url, title: p.title, slug: slugFromUrl(p.url), tables: p.tables.length }));
  res.json({ q, count: results.length, results });
});

app.get("/tables/top", (req, res) => {
  const c = ensureCache();
  if (!c) return res.status(404).json({ error: "No data scraped yet" });
  const header = String(req.query.header ?? "").trim();
  if (!header) return res.status(400).json({ error: "header is required" });
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows: { value: number; row: string[]; headers: string[]; page: { url: string; title: string; slug: string }; tableIndex: number; rowIndex: number }[] = [];

  for (const page of c.pages) {
    const slug = slugFromUrl(page.url);
    page.tables.forEach((t, ti) => {
      const col = t.headers.findIndex((h) => h.toLowerCase() === header.toLowerCase());
      if (col < 0) return;
      t.rows.forEach((row, ri) => {
        const raw = row[col];
        const num = Number(String(raw).replace(/[^0-9.-]/g, ""));
        if (!Number.isFinite(num)) return;
        rows.push({ value: num, row, headers: t.headers, page: { url: page.url, title: page.title, slug }, tableIndex: ti, rowIndex: ri });
      });
    });
  }

  rows.sort((a, b) => b.value - a.value);
  res.json({ header, count: rows.length, results: rows.slice(0, limit) });
});

app.get("/tables/distinct", (req, res) => {
  const c = ensureCache();
  if (!c) return res.status(404).json({ error: "No data scraped yet" });
  const header = String(req.query.header ?? "").trim();
  if (!header) return res.status(400).json({ error: "header is required" });
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const counts = new Map<string, number>();

  for (const page of c.pages) {
    page.tables.forEach((t) => {
      const col = t.headers.findIndex((h) => h.toLowerCase() === header.toLowerCase());
      if (col < 0) return;
      t.rows.forEach((row) => {
        const key = row[col];
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    });
  }

  const result = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));

  res.json({ header, count: result.length, results: result });
});

app.get("/links", (_req, res) => {
  const c = ensureCache();
  if (!c) return res.status(404).json({ error: "No data scraped yet" });
  const links = new Set<string>();
  c.pages.forEach((p) => p.links.forEach((l) => links.add(l)));
  res.json(Array.from(links));
});

app.get("/charts/apple-music/worldwide", (_req, res) => {
  const page =
    findPageByTitleOrUrl("worldwide apple music song chart") ||
    findPageByTitleOrUrl("apple music song chart") ||
    findPageByTitleOrUrl("apple_songs");
  if (!page) return res.status(404).json({ error: "Apple Music chart not found" });
  res.json({ page: { url: page.url, title: page.title, slug: slugFromUrl(page.url) }, tables: page.tables });
});

app.get("/charts/youtube/trending/worldwide", (_req, res) => {
  const page = findPageByTitleOrUrl("trending worldwide") || findPageByTitleOrUrl("/youtube/trending");
  if (!page) return res.status(404).json({ error: "YouTube trending worldwide not found" });
  res.json({ page: { url: page.url, title: page.title, slug: slugFromUrl(page.url) }, tables: page.tables });
});

app.get("/charts/spotify", (req, res) => {
  const country = String(req.query.country ?? "Global").trim();
  const period = String(req.query.period ?? "Daily").trim();
  const needle = `${country} ${period} spotify`.toLowerCase();
  const page = findPageByTitleOrUrl(needle) || findPageByTitleOrUrl("spotify charts");
  if (!page) return res.status(404).json({ error: "Spotify chart not found" });
  res.json({
    page: { url: page.url, title: page.title, slug: slugFromUrl(page.url) },
    hint: { country, period },
    tables: page.tables,
  });
});

app.post("/scrape", async (_req, res) => {
  try {
    const data = await scrapeKworb();
    cache = await saveCache(data);
    res.json({ status: "ok", pages: data.pages.length, updatedAt: cache.lastUpdated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Scrape failed" });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
