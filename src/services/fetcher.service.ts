export interface NormalizedArticle {
  title: string;
  url: string;
  source: string;
  author?: string;
  publishedAt?: string;
  contentSnippet?: string;
}

interface HNItem {
  id: number;
  title: string;
  url?: string;
  by?: string;
  time?: number;
}

interface DevToArticle {
  title: string;
  url: string;
  published_at: string;
  description?: string;
  user?: {
    name?: string;
  };
}

export async function fetchHackerNews(
  limit = 30,
): Promise<NormalizedArticle[]> {
  const topRes = await fetch(
    "https://hacker-news.firebaseio.com/v0/topstories.json",
  );
  if (!topRes.ok) {
    throw new Error(`HN topstories failed: ${topRes.status}`);
  }

  const ids = (await topRes.json()) as number[];
  const topIds = ids.slice(0, limit);

  const items = await Promise.all(
    topIds.map(async (id) => {
      const itemRes = await fetch(
        `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
      );
      if (!itemRes.ok) return null;
      return (await itemRes.json()) as HNItem;
    }),
  );

  return items
    .filter(
      (item): item is HNItem & { url: string } =>
        item !== null && item.url !== undefined && item.url !== "",
    )
    .map((item) => ({
      title: item.title,
      url: item.url,
      source: "HackerNews",
      author: item.by ?? undefined,
      publishedAt: item.time
        ? new Date(item.time * 1000).toISOString()
        : undefined,
    }));
}

export async function fetchDevTo(
  tags: string[],
  limit = 30,
): Promise<NormalizedArticle[]> {
  const perPage = Math.min(limit, 100);

  const results = await Promise.allSettled(
    tags.map(async (tag) => {
      const url = `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=${perPage}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Dev.to API error for tag "${tag}": ${res.status}`);
      }
      return (await res.json()) as DevToArticle[];
    }),
  );

  const allArticles: NormalizedArticle[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const article of result.value) {
        allArticles.push({
          title: article.title,
          url: article.url,
          source: "DevTo",
          author: article.user?.name ?? undefined,
          publishedAt: article.published_at,
          contentSnippet: article.description ?? undefined,
        });
      }
    } else {
      console.error("[fetcher] DevTo fetch failed:", result.reason);
    }
  }

  return allArticles.slice(0, limit);
}

export async function fetchAllSources(): Promise<NormalizedArticle[]> {
  console.log("[fetcher] Starting fetch from all sources...");

  const results = await Promise.allSettled([
    fetchHackerNews(30),
    fetchDevTo(["programming", "javascript", "typescript", "python", "go"], 30),
  ]);

  const allArticles: NormalizedArticle[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      allArticles.push(...result.value);
    } else {
      console.error("[fetcher] Source fetch failed:", result.reason);
    }
  }

  console.log(`[fetcher] Fetched ${allArticles.length} articles total`);
  return allArticles;
}
