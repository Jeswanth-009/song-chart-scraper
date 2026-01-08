import * as cheerio from "cheerio";
import { TableData } from "../types.js";

export const extractTables = (html: string): TableData[] => {
  const $ = cheerio.load(html);
  const tables: TableData[] = [];

  $("table").each((_, table) => {
    const caption = $(table).find("caption").first().text().trim() || undefined;
    const headers = $(table)
      .find("thead tr th, tr:first-child th")
      .map((_, th) => $(th).text().trim())
      .get();

    const rows = $(table)
      .find("tbody tr")
      .map((_, row) => $(row)
          .find("td")
          .map((__, cell) => $(cell).text().trim())
          .get())
      .get()
      .filter((row) => row.length > 0);

    if (headers.length === 0 && rows.length === 0) return;
    tables.push({ caption, headers, rows });
  });

  return tables;
};

export const extractLinks = (html: string, base: string): string[] => {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  const baseHost = new URL(base).hostname;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const resolved = new URL(href, base);
      if (resolved.hostname === baseHost) urls.add(resolved.toString());
    } catch {
      // ignore invalid links
    }
  });

  return Array.from(urls);
};
