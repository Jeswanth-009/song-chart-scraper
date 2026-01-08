import cron from "node-cron";
import { config } from "./config.js";
import { scrapeKworb } from "./scraper/kworbScraper.js";
import { saveCache } from "./storage/store.js";

const schedule = () => {
  console.log(`[scheduler] starting with cron ${config.cron}`);
  cron.schedule(config.cron, async () => {
    console.log(`[scheduler] running scrape at ${new Date().toISOString()}`);
    const data = await scrapeKworb();
    await saveCache(data);
    console.log(`[scheduler] scrape finished. pages=${data.pages.length}`);
  });
};

schedule();
