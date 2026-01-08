import { loadCache as loadLocal, saveCache as saveLocal } from "./localStore.js";
import { loadCacheSupabase, saveCacheSupabase } from "./supabaseStore.js";
import { loadCacheR2, saveCacheR2 } from "./r2Store.js";
import { loadCacheGitHub, saveCacheGitHub } from "./githubStore.js";
import { CrawlResult, StorePayload } from "../types.js";

const useGitHub = () => Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
const useSupabase = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE);
const useR2 = () => Boolean(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);

export const saveCache = async (data: CrawlResult): Promise<StorePayload> => {
  if (useGitHub()) {
    console.log("[storage] using GitHub backend");
    return saveCacheGitHub(data);
  }
  if (useR2()) {
    console.log("[storage] using R2 backend");
    return saveCacheR2(data);
  }
  if (useSupabase()) {
    console.log("[storage] using Supabase backend");
    return saveCacheSupabase(data);
  }
  return saveLocal(data);
};

export const loadCache = async (): Promise<StorePayload | null> => {
  if (useGitHub()) {
    try {
      console.log("[storage] loading from GitHub backend");
      return await loadCacheGitHub();
    } catch (err) {
      console.warn(`[storage] GitHub load failed, falling back: ${(err as Error).message}`);
    }
  }
  if (useR2()) {
    try {
      console.log("[storage] loading from R2 backend");
      return await loadCacheR2();
    } catch (err) {
      console.warn(`[storage] R2 load failed, falling back: ${(err as Error).message}`);
    }
  }
  if (useSupabase()) {
    try {
      console.log("[storage] loading from Supabase backend");
      return await loadCacheSupabase();
    } catch (err) {
      console.warn(`[storage] supabase load failed, falling back to local: ${(err as Error).message}`);
    }
  }
  return loadLocal();
};
