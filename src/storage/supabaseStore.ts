import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import { CrawlResult, StorePayload } from "../types.js";

const tableName = process.env.SUPABASE_TABLE ?? "scrape_cache";
const recordId = process.env.SUPABASE_RECORD_ID ?? "kworb";
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET;
const storagePath = process.env.SUPABASE_STORAGE_PATH ?? "cache/kworb.json";

const getClient = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE are required");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
};

const withRetry = async <T>(fn: () => Promise<T>, attempts = 3, delayMs = 2000): Promise<T> => {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLast = i === attempts;
      console.warn(`[supabase] attempt ${i}/${attempts} failed: ${(err as Error).message}`);
      if (isLast) break;
      await new Promise((r) => setTimeout(r, delayMs * i));
    }
  }
  throw lastErr;
};

export const saveCacheSupabase = async (data: CrawlResult): Promise<StorePayload> => {
  const client = getClient();
  const payload: StorePayload = {
    ...data,
    lastUpdated: new Date().toISOString(),
  };
  if (storageBucket) {
    const execUpload = async () => {
      const { error } = await client.storage
        .from(storageBucket)
        .upload(storagePath, JSON.stringify(payload), {
          cacheControl: "3600",
          upsert: true,
          contentType: "application/json",
        });
      if (error) throw error;
    };
    await withRetry(execUpload, 3, 2000);
    console.log(`[supabase] storage upload ok to ${storageBucket}/${storagePath}`);
    return payload;
  }

  const execUpsert = async () => {
    const { error } = await client
      .from(tableName)
      .upsert({ id: recordId, payload, updated_at: new Date().toISOString(), source: config.baseUrl });
    if (error) throw error;
  };

  await withRetry(execUpsert, 3, 2000);
  console.log(`[supabase] upsert ok for id=${recordId} into ${tableName}`);
  return payload;
};

export const loadCacheSupabase = async (): Promise<StorePayload | null> => {
  const client = getClient();
  if (storageBucket) {
    const { data, error } = await client.storage.from(storageBucket).download(storagePath);
    if (error) throw error;
    const text = await data.text();
    return JSON.parse(text) as StorePayload;
  }

  const { data, error } = await client.from(tableName).select("payload").eq("id", recordId).maybeSingle();
  if (error) throw error;
  if (!data || !data.payload) return null;
  return data.payload as StorePayload;
};
