import fs from "fs-extra";
import { dirname } from "path";
import { config } from "../config.js";
import { CrawlResult, StorePayload } from "../types.js";

export const saveCache = async (data: CrawlResult): Promise<StorePayload> => {
  const payload: StorePayload = {
    ...data,
    lastUpdated: new Date().toISOString(),
  };
  const dir = dirname(config.dataFile);
  await fs.ensureDir(dir);
  await fs.writeJson(config.dataFile, payload, { spaces: 2 });
  return payload;
};

export const loadCache = async (): Promise<StorePayload | null> => {
  if (!(await fs.pathExists(config.dataFile))) return null;
  const data = await fs.readJson(config.dataFile);
  return data as StorePayload;
};
