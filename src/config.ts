import dotenv from "dotenv";

dotenv.config();

const numberFromEnv = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseSeeds = (): string[] => {
  const raw = process.env.SCRAPE_SEEDS;
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => new URL(s, "https://kworb.net/").toString());
  }
  return [
    "https://kworb.net/",
    "https://kworb.net/ww/",
    "https://kworb.net/itunes/",
    "https://kworb.net/charts/",
    "https://kworb.net/spotify/",
    "https://kworb.net/youtube/",
    "https://kworb.net/youtube/trending.html",
  ];
};

export const config = {
  baseUrl: process.env.SCRAPE_BASE_URL ?? "https://kworb.net/",
  seeds: parseSeeds(),
  maxPages: numberFromEnv("SCRAPE_MAX_PAGES", 2000),
  fetchDelayMs: numberFromEnv("SCRAPE_FETCH_DELAY_MS", 800),
  userAgent:
    process.env.SCRAPE_USER_AGENT ??
    "Mozilla/5.0 (compatible; kworb-scraper/1.0; +https://example.com)",
  cron: process.env.SCRAPE_CRON ?? "0 3 * * *",
  dataFile: process.env.SCRAPE_DATA_FILE ?? "data/kworb.json",
};
