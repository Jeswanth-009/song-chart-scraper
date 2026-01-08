export type TableRow = string[];

export interface TableData {
  caption?: string;
  headers: string[];
  rows: TableRow[];
}

export interface ScrapedPage {
  url: string;
  title: string;
  tables: TableData[];
  links: string[];
  fetchedAt: string;
}

export interface CrawlResult {
  source: string;
  startedAt: string;
  finishedAt: string;
  pages: ScrapedPage[];
}

export interface StorePayload extends CrawlResult {
  lastUpdated: string;
}
