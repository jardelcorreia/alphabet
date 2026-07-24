// Função Netlify melhorada para buscar dados da Football API
// Versão com cache, status estável e retry automático

// Cache em memória para reduzir chamadas à API
const cache = new Map();
const lastApiCall = new Map();

// Configurações de cache baseadas no status dos jogos
const getCacheTTL = (matches) => {
  if (!matches || matches.length === 0) return 5 * 60 * 1000; // 5 minutos se não há jogos

  const hasLiveGames = matches.some((match) =>
    ["IN_PLAY", "PAUSED", "HALFTIME"].includes(match.status?.toUpperCase()),
  );

  const hasFinishedGames = matches.some(
    (match) => match.status?.toUpperCase() === "FINISHED",
  );

  const hasScheduledGames = matches.some((match) =>
    ["SCHEDULED", "TIMED"].includes(match.status?.toUpperCase()),
  );

  // Determinar TTL baseado nos tipos de jogos
  if (hasLiveGames) {
    return 30 * 1000; // 30 segundos - jogos ao vivo precisam de atualização frequente
  } else if (hasScheduledGames && !hasFinishedGames) {
    return 10 * 60 * 1000; // 10 minutos - apenas jogos agendados
  } else if (hasFinishedGames && !hasScheduledGames) {
    return 60 * 60 * 1000; // 1 hora - apenas jogos finalizados
  } else {
    return 5 * 60 * 1000; // 5 minutos - situação mista
  }
};

// Controle de rate limiting
const shouldFetchFromApi = (cacheKey) => {
  const last = lastApiCall.get(cacheKey);
  const MIN_INTERVAL = 30000; // 30 segundos mínimo entre chamadas

  if (!last || Date.now() - last > MIN_INTERVAL) {
    lastApiCall.set(cacheKey, Date.now());
    return true;
  }

  console.log(
    `[RATE LIMIT] Bloqueando chamada para ${cacheKey}, última chamada há ${
      Date.now() - last
    }ms`,
  );
  return false;
};

// Função para buscar dados da API com retry e backoff exponencial
const fetchFromApiWithRetry = async (url, headers, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[API CALL] Tentativa ${attempt}/${maxRetries} para ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers,
        timeout: 10000, // 10 segundos de timeout
      });

      console.log(`[API RESPONSE] Status: ${response.status}`);

      if (response.ok) {
        return await response.json();
      }

      // Tratamento específico para rate limiting
      if (response.status === 429) {
        const retryAfter =
          response.headers.get("Retry-After") || attempt * 3;
        console.log(
          `[RATE LIMITED] Aguardando ${retryAfter}s antes da próxima tentativa`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, retryAfter * 1000),
        );
        continue;
      }

      // Outros erros HTTP
      const errorText = await response.text();
      console.error(`[API ERROR] ${response.status}: ${errorText}`);

      if (response.status >= 500 && attempt < maxRetries) {
        // Erro do servidor, tentar novamente
        const delay = Math.pow(2, attempt) * 1000; // Backoff exponencial
        console.log(
          `[RETRY] Erro do servidor, tentando novamente em ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      console.error(`[API ERROR] Tentativa ${attempt} falhou:`, error.message);

      if (attempt === maxRetries) {
        throw error;
      }

      // Backoff exponencial para erros de rede
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[RETRY] Tentando novamente em ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Normalizar e estabilizar status dos jogos
const normalizeMatchStatus = (match) => {
  const originalStatus = match.status;
  const matchDate = new Date(match.utcDate);
  const now = new Date();

  // Manter status original se já estiver normalizado
  if (!originalStatus) {
    return { ...match, status: "SCHEDULED", statusSource: "normalized" };
  }

  const upperStatus = originalStatus.toUpperCase();

  // Regras de normalização
  switch (upperStatus) {
    case "FINISHED":
      return { ...match, status: "FINISHED", statusSource: "stable" };

    case "IN_PLAY":
    case "PAUSED":
    case "HALFTIME":
      return { ...match, status: "IN_PLAY", statusSource: "live" };

    case "SCHEDULED":
    case "TIMED":
      // Verificar se o jogo não deveria estar finalizado
      if (now - matchDate > 3 * 60 * 60 * 1000) {
        console.warn(
          `[STATUS WARNING] Jogo ${match.id
          } agendado mas já passou 3h da data: ${matchDate.toISOString()}`,
        );
      }
      return { ...match, status: "SCHEDULED", statusSource: "normalized" };

    case "POSTPONED":
      return { ...match, status: "POSTPONED", statusSource: "stable" };

    case "SUSPENDED":
      return { ...match, status: "SUSPENDED", statusSource: "stable" };

    case "CANCELLED":
      return { ...match, status: "CANCELLED", statusSource: "stable" };

    default:
      console.warn(
        `[STATUS UNKNOWN] Status desconhecido: ${originalStatus}, normalizando para SCHEDULED`,
      );
      return { ...match, status: "SCHEDULED", statusSource: "fallback" };
  }
};

const processApiData = (data, currentRound) => {
  if (!data || !data.matches) {
    return {
      ...data,
      matches: [],
      currentRound: currentRound,
    };
  }

  const processedMatches = data.matches.map((match) =>
    normalizeMatchStatus(match),
  );

  const statusStats = {};
  processedMatches.forEach((match) => {
    const status = match.status;
    statusStats[status] = (statusStats[status] || 0) + 1;
  });

  console.log("[PROCESSING] Estatísticas de status:", statusStats);

  return {
    ...data,
    matches: processedMatches,
    currentRound: currentRound, // Usa a rodada atual passada como argumento
    processing: {
      total: processedMatches.length,
      statusStats,
      processedAt: new Date().toISOString(),
    },
  };
};

// Função principal
exports.handler = async (event, context) => {
  const competitionUrl = "https://api.football-data.org/v4/competitions/BSA";
  const matchesUrl = "https://api.football-data.org/v4/competitions/BSA/matches";
  const apiKey = "5f121390e2cc480d8d0f8dba3b37a435";

  const forceRefresh = event.queryStringParameters?.forceRefresh === "true";
  const cacheKey = "BSA_all_matches_and_round";

  console.log(
    `[FETCH START] Iniciando busca para ${cacheKey}, forceRefresh: ${forceRefresh}`,
  );

  try {
    let data;

    if (!forceRefresh && cache.has(cacheKey)) {
      const cachedEntry = cache.get(cacheKey);
      const age = Date.now() - cachedEntry.timestamp;
      const ttl = getCacheTTL(cachedEntry.data.matches);

      if (age < ttl) {
        console.log(
          `[CACHE HIT] Usando dados em cache (${Math.floor(
            age / 1000,
          )}s atrás, TTL: ${Math.floor(ttl / 1000)}s)`,
        );
        data = cachedEntry.data;
      } else {
        console.log(
          `[CACHE EXPIRED] Cache expirado (${Math.floor(age / 1000)}s > ${
            Math.floor(ttl / 1000)
          }s)`,
        );
        cache.delete(cacheKey);
      }
    }

    if (!data && (forceRefresh || shouldFetchFromApi(cacheKey))) {
      console.log("Buscando dados da API Football...");

      // Buscar dados da competição e dos jogos em paralelo
      const [competitionData, rawMatchesData] = await Promise.all([
        fetchFromApiWithRetry(competitionUrl, { "X-Auth-Token": apiKey }),
        fetchFromApiWithRetry(matchesUrl, { "X-Auth-Token": apiKey }),
      ]);

      const currentRound =
        competitionData?.currentSeason?.currentMatchday || 1;

      data = processApiData(rawMatchesData, currentRound);

      cache.set(cacheKey, {
        data: data,
        timestamp: Date.now(),
      });

      console.log(`[CACHE STORED] Dados armazenados em cache para ${cacheKey}`);
    } else if (!data && cache.has(cacheKey)) {
      const cachedEntry = cache.get(cacheKey);
      const age = Date.now() - cachedEntry.timestamp;
      console.log(
        `[CACHE FALLBACK] Usando cache expirado (${Math.floor(
          age / 1000,
        )}s atrás) devido ao rate limiting`,
      );
      data = cachedEntry.data;
    }

    if (!data) {
      throw new Error("Dados não disponíveis e não há cache de fallback");
    }

    if (cache.size > 10) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
      console.log(`[CACHE CLEANUP] Removido cache antigo: ${oldestKey}`);
    }

    console.log(`[SUCCESS] Retornando ${data.matches?.length || 0} jogos`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ...data,
        meta: {
          cached: !data.processing, // Se não foi processado, veio do cache
          cacheKey,
          timestamp: new Date().toISOString(),
        },
      }),
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30",
      },
    };
  } catch (error) {
    console.error("Erro no fetch:", error.message);
    console.error("Stack trace:", error.stack);

    if (cache.has(cacheKey)) {
      const cachedEntry = cache.get(cacheKey);
      const age = Date.now() - cachedEntry.timestamp;
      console.log(
        `[ERROR FALLBACK] Usando cache de emergência (${Math.floor(
          age / 1000,
        )}s atrás)`,
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          ...cachedEntry.data,
          meta: {
            cached: true,
            fallback: true,
            error: error.message,
            cacheAge: age,
            timestamp: new Date().toISOString(),
          },
        }),
        headers: {
          "Content-Type": "application/json",
          "X-Fallback": "true",
        },
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Erro interno do servidor",
        details:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Erro ao buscar dados da API",
        timestamp: new Date().toISOString(),
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
};
