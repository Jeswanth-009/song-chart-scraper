import * as cheerio from "cheerio";
import { config } from "../config.js";
import { delay, fetchHtml } from "../utils/http.js";
import { extractLinks, extractTables } from "../utils/parse.js";
import { CrawlResult, ScrapedPage } from "../types.js";

const getTitle = (html: string): string => {
  const $ = cheerio.load(html);
  return $("title").first().text().trim() || "Untitled";
};

const normalizeUrl = (url: string): string | null => {
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
};

export const scrapeKworb = async (): Promise<CrawlResult> => {
  const startedAt = new Date().toISOString();
  const visited = new Set<string>();
  const queue: string[] = config.seeds
    .map((s) => normalizeUrl(s))
    .filter((s): s is string => Boolean(s));
  const pages: ScrapedPage[] = [];
  const baseHost = new URL(config.baseUrl).hostname;

  while (queue.length > 0 && pages.length < config.maxPages) {
    const url = queue.shift();
    if (!url) break;
    if (visited.has(url)) continue;

    if (new URL(url).hostname !== baseHost) continue;

    visited.add(url);
    console.log(`[scrape] fetching ${url}`);
    let html: string | null = null;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      console.warn(`[scrape] skip ${url} (${(err as Error).message})`);
      continue;
    }

    const title = getTitle(html);
    const tables = extractTables(html);
    const links = extractLinks(html, url);

    pages.push({ url, title, tables, links, fetchedAt: new Date().toISOString() });

    let remainingSlots = config.maxPages - pages.length;
    for (const link of links) {
      if (remainingSlots <= 0) break;
      const normalized = normalizeUrl(link);
      if (!normalized) continue;
      if (visited.has(normalized)) continue;
      if (new URL(normalized).hostname !== baseHost) continue;
      queue.push(normalized);
      remainingSlots -= 1;
    }

    if (queue.length > 0 && config.fetchDelayMs > 0) {
      await delay(config.fetchDelayMs);
    }
  }

  const finishedAt = new Date().toISOString();
  return { source: config.baseUrl, startedAt, finishedAt, pages };
};
