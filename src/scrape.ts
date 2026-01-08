import { scrapeKworb } from "./scraper/kworbScraper.js";
import { saveCache } from "./storage/store.js";

const run = async () => {
  const result = await scrapeKworb();
  await saveCache(result);
  console.log(`[scrape] done. pages=${result.pages.length}`);
};

run().catch((err) => {
  console.error("[scrape] failed", err);
  process.exit(1);
});
