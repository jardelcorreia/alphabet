// Netlify function to fetch official standings from the Football API

const cache = new Map();
const lastApiCall = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache for standings (they don't change as often)

const shouldFetchFromApi = (cacheKey) => {
  const last = lastApiCall.get(cacheKey);
  const MIN_INTERVAL = 30000; // 30 seconds minimum between calls

  if (!last || Date.now() - last > MIN_INTERVAL) {
    lastApiCall.set(cacheKey, Date.now());
    return true;
  }
  return false;
};

const fetchFromApiWithRetry = async (url, headers, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { method: "GET", headers, timeout: 10000 });
      if (response.ok) return await response.json();

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After") || attempt * 3;
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (response.status >= 500 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

exports.handler = async (event, context) => {
  const url = "https://api.football-data.org/v4/competitions/BSA/standings";
  const apiKey = "5f121390e2cc480d8d0f8dba3b37a435";
  const cacheKey = "BSA_standings";

  try {
    let data;

    if (cache.has(cacheKey)) {
      const cachedEntry = cache.get(cacheKey);
      const age = Date.now() - cachedEntry.timestamp;

      if (age < CACHE_TTL) {
        data = cachedEntry.data;
      } else {
        cache.delete(cacheKey);
      }
    }

    if (!data && shouldFetchFromApi(cacheKey)) {
      const apiData = await fetchFromApiWithRetry(url, { "X-Auth-Token": apiKey });

      // We usually only need the total standings
      const totalStandings = apiData.standings?.find(s => s.type === 'TOTAL') || apiData.standings?.[0];

      data = {
        season: apiData.season,
        standings: totalStandings ? totalStandings.table : []
      };

      cache.set(cacheKey, { data, timestamp: Date.now() });
    } else if (!data && cache.has(cacheKey)) {
       data = cache.get(cacheKey).data;
    }

    if (!data) throw new Error("Data not available");

    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800",
      },
    };

  } catch (error) {
    console.error("Error fetching standings:", error);

    if (cache.has(cacheKey)) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ...cache.get(cacheKey).data, fallback: true }),
        headers: { "Content-Type": "application/json" }
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch standings" }),
      headers: { "Content-Type": "application/json" }
    };
  }
};
