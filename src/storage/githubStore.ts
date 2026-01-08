import { CrawlResult, StorePayload } from "../types.js";

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPO; // format: owner/repo
const branch = process.env.GITHUB_BRANCH ?? "main";
const filePath = (process.env.GITHUB_PATH ?? "data/kworb.json").replace(/^\/+/, ""); // strip leading slashes

const apiBase = "https://api.github.com";

const assertConfig = () => {
  if (!token) throw new Error("GITHUB_TOKEN is required for GitHub storage");
  if (!repo) throw new Error("GITHUB_REPO is required (format: owner/repo)");
};

const githubRequest = async (path: string, init?: RequestInit) => {
  assertConfig();
  const resp = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "kworb-scraper",
      ...init?.headers,
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API ${resp.status} ${resp.statusText}: ${text}`);
  }
  return resp;
};

const getCurrentSha = async (): Promise<string | null> => {
  try {
    const resp = await githubRequest(`/repos/${repo}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`);
    const json = (await resp.json()) as { sha?: string };
    return json.sha ?? null;
  } catch (err) {
    if ((err as Error).message.includes("404")) return null;
    throw err;
  }
};

export const loadCacheGitHub = async (): Promise<StorePayload | null> => {
  const resp = await githubRequest(`/repos/${repo}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`);
  const json = (await resp.json()) as { content?: string; encoding?: string };
  if (!json.content) return null;
  const decoded = Buffer.from(json.content, json.encoding ?? "base64").toString("utf8");
  return JSON.parse(decoded) as StorePayload;
};

export const saveCacheGitHub = async (data: CrawlResult): Promise<StorePayload> => {
  const payload: StorePayload = { ...data, lastUpdated: new Date().toISOString() };
  const contentBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const sha = await getCurrentSha();

  await githubRequest(`/repos/${repo}/contents/${encodeURIComponent(filePath)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: "chore: update kworb cache",
      content: contentBase64,
      branch,
      sha: sha ?? undefined,
    }),
  });

  console.log(`[github] upload ok to ${repo}@${branch}:${filePath}`);
  return payload;
};
