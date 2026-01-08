import { CrawlResult, StorePayload } from "../types.js";
import { config } from "../config.js";
import crypto from "crypto";
import { Readable } from "stream";

const endpoint = process.env.R2_ENDPOINT; // e.g., https://<accountid>.r2.cloudflarestorage.com
const bucket = process.env.R2_BUCKET;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const objectKey = process.env.R2_OBJECT_KEY ?? "kworb/cache.json";

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  // handled at runtime in store.ts
}

// Minimal S3-compatible signed request using AWS Signature V4
const sign = (
  method: string,
  url: URL,
  headers: Record<string, string>,
  bodyHash: string
): Record<string, string> => {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|/g, "").replace(/\.\d{3}Z$/, "Z");
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto"; // R2 uses "auto"
  const service = "s3";

  const canonicalUri = url.pathname;
  const canonicalQuery = url.searchParams.toString();
  const signedHeaders = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort()
    .join(";");

  const canonicalHeaders = Object.keys(headers)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((h) => `${h.toLowerCase()}:${headers[h]}\n`)
    .join("");

  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, bodyHash].join("\n");

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [algorithm, amzDate, credentialScope, sha256(canonicalRequest)].join("\n");

  const signingKey = getSignatureKey(secretAccessKey!, dateStamp, region, service);
  const signature = hmac(signingKey, stringToSign).toString("hex");

  const authHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { ...headers, Authorization: authHeader, "x-amz-date": amzDate }; // amz-date already in headers
};

const sha256 = (data: string | Buffer) => crypto.createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string) => crypto.createHmac("sha256", key).update(data).digest();

const getSignatureKey = (key: string, dateStamp: string, region: string, service: string) => {
  const kDate = hmac(`AWS4${key}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
};

const putObject = async (key: string, body: string) => {
  if (!endpoint || !bucket) throw new Error("R2 config missing");
  const url = new URL(`${endpoint}/${bucket}/${key}`);
  const bodyHash = sha256(body);
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": bodyHash,
    "x-amz-date": new Date().toISOString().replace(/[:-]|\.\d{3}Z/g, "") + "Z",
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body).toString(),
  };
  const signed = sign("PUT", url, headers, bodyHash);
  const resp = await fetch(url, { method: "PUT", headers: signed, body });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`R2 PUT failed: ${resp.status} ${resp.statusText} ${text}`);
  }
};

const getObject = async (key: string): Promise<string> => {
  if (!endpoint || !bucket) throw new Error("R2 config missing");
  const url = new URL(`${endpoint}/${bucket}/${key}`);
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": sha256(""),
    "x-amz-date": new Date().toISOString().replace(/[:-]|\.\d{3}Z/g, "") + "Z",
  };
  const signed = sign("GET", url, headers, headers["x-amz-content-sha256"]);
  const resp = await fetch(url, { method: "GET", headers: signed });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`R2 GET failed: ${resp.status} ${resp.statusText} ${text}`);
  }
  return await resp.text();
};

export const saveCacheR2 = async (data: CrawlResult): Promise<StorePayload> => {
  const payload: StorePayload = { ...data, lastUpdated: new Date().toISOString() };
  const body = JSON.stringify(payload);
  await putObject(objectKey, body);
  console.log(`[r2] upload ok to ${bucket}/${objectKey}`);
  return payload;
};

export const loadCacheR2 = async (): Promise<StorePayload | null> => {
  try {
    const text = await getObject(objectKey);
    return JSON.parse(text) as StorePayload;
  } catch (err) {
    if ((err as Error).message.includes("404")) return null;
    throw err;
  }
};
