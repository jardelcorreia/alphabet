
// Função Netlify melhorada para buscar dados da Football API
// Versão com cache, status estável e retry automático

// Cache em memória para reduzir chamadas à API
const cache = new Map();
const lastApiCall = new Map();

// Configurações de cache baseadas no status dos jogos
const getCacheTTL = (matches) => {
  if (!matches || matches.length === 0) return 5 * 60 * 1000; // 5 minutos se não há jogos

  const hasLiveGames = matches.some(
    (match) =>
      ["IN_PLAY", "PAUSED", "HALFTIME"].includes(match.status?.toUpperCase()),
  );

  const hasFinishedGames = matches.some(
    (match) => match.status?.toUpperCase() === "FINISHED",
  );

  const hasScheduledGames = matches.some(
    (match) =>
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

// Processar e normalizar dados da API
const processApiData = (data) => {
  if (!data || !data.matches) {
    return data;
  }

  const processedMatches = data.matches.map((match) =>
    normalizeMatchStatus(match),
  );

  // Lógica para determinar a rodada atual
  const partidasPorRodada = {};
  processedMatches.forEach((partida) => {
    const rodada = partida.matchday;
    if (!partidasPorRodada[rodada]) partidasPorRodada[rodada] = [];
    partidasPorRodada[rodada].push(partida);
  });

  const rodadasComInfo = Object.keys(partidasPorRodada).map((numRodadaStr) => {
    const numeroRodada = Number(numRodadaStr);
    const jogosDaRodada = partidasPorRodada[numeroRodada];

    let dataInicio = new Date("2999-12-31T23:59:59Z");
    let temJogoAtivo = false;
    let jogosNaoAdiados = 0;
    let jogosNaoAdiadosFinalizados = 0;

    if (jogosDaRodada.length > 0) {
      for (const jogo of jogosDaRodada) {
        if (jogo.utcDate) {
          const dataJogo = new Date(jogo.utcDate);
          if (dataJogo < dataInicio) {
            dataInicio = dataJogo;
          }
        }

        if (
          jogo.status === "IN_PLAY" ||
          jogo.status === "PAUSED" ||
          jogo.status === "LIVE"
        ) {
          temJogoAtivo = true;
        }

        if (jogo.status !== "POSTPONED" && jogo.status !== "CANCELLED") {
          jogosNaoAdiados++;
          if (jogo.status === "FINISHED") {
            jogosNaoAdiadosFinalizados++;
          }
        }
      }
    }

    const todosJogosFinalizados = jogosDaRodada.every(
      (jogo) => jogo.status === "FINISHED",
    );

    const efetivamenteFinalizada =
      jogosNaoAdiados > 0 && jogosNaoAdiados === jogosNaoAdiadosFinalizados;

    return {
      numeroRodada,
      dataInicio,
      todosJogosFinalizados,
      efetivamenteFinalizada,
      temJogoAtivo,
    };
  });

  rodadasComInfo.sort((a, b) => a.numeroRodada - b.numeroRodada);

  let rodadaParaExibir = 0;
  const agora = new Date();
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0); // Normaliza para o início do dia

  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);

  let rodadaAtiva = rodadasComInfo.find((r) => r.temJogoAtivo);

  if (rodadaAtiva) {
    // 1. Mostrar a rodada que tem jogo acontecendo agora
    rodadaParaExibir = rodadaAtiva.numeroRodada;
  } else {
    let rodadasComJogoEmBreve = [];

    // Procurar jogos hoje ou amanhã em qualquer rodada
    for (const rodadaStr in partidasPorRodada) {
      const jogosDaRodada = partidasPorRodada[rodadaStr];
      const numeroRodada = parseInt(rodadaStr);
      let temJogoHojeOuAmanha = false;

      for (const jogo of jogosDaRodada) {
        if (jogo.status !== "FINISHED" && jogo.utcDate) {
          const dataJogo = new Date(jogo.utcDate);
          const diaDoJogo = new Date(dataJogo);
          diaDoJogo.setHours(0, 0, 0, 0);

          if (
            diaDoJogo.getTime() === hoje.getTime() ||
            diaDoJogo.getTime() === amanha.getTime()
          ) {
            temJogoHojeOuAmanha = true;
            break;
          }
        }
      }

      if (temJogoHojeOuAmanha) {
        rodadasComJogoEmBreve.push(numeroRodada);
      }
    }

    if (rodadasComJogoEmBreve.length > 0) {
      // 2. Mostrar a rodada mais próxima com jogos hoje ou amanhã
      rodadaParaExibir = Math.min(...rodadasComJogoEmBreve);
    } else {
      // 3. Encontrar a primeira rodada que NÃO está efetivamente finalizada (ignorando jogos adiados)
      let rodadaPendente = null;
      for (const r of rodadasComInfo) {
        if (!r.efetivamenteFinalizada && !r.todosJogosFinalizados) {
          rodadaPendente = r.numeroRodada;
          break;
        }
      }

      if (rodadaPendente) {
        rodadaParaExibir = rodadaPendente;
      } else {
        // 4. Fallback: Mostrar a última rodada de todas
        rodadaParaExibir =
          rodadasComInfo.length > 0
            ? rodadasComInfo[rodadasComInfo.length - 1].numeroRodada
            : 1;
      }
    }
  }

  // Estatísticas de processamento
  const statusStats = {};
  processedMatches.forEach((match) => {
    const status = match.status;
    statusStats[status] = (statusStats[status] || 0) + 1;
  });

  console.log("[PROCESSING] Estatísticas de status:", statusStats);

  return {
    ...data,
    matches: processedMatches,
    currentRound: rodadaParaExibir, // Adiciona a rodada atual na resposta
    processing: {
      total: processedMatches.length,
      statusStats,
      processedAt: new Date().toISOString(),
    },
  };
};

// Função principal
exports.handler = async (event, context) => {
  const url = "https://api.football-data.org/v4/competitions/BSA/matches";
  const apiKey = "5f121390e2cc480d8d0f8dba3b37a435";

  // Parâmetros opcionais
  const forceRefresh = event.queryStringParameters?.forceRefresh === "true";
  const round = event.queryStringParameters?.round;

  // Construir URL com parâmetros
  let finalUrl = url;
  if (round) {
    finalUrl += `?matchday=${round}`;
  }

  const cacheKey = `BSA_${round || "all"}`;

  console.log(
    `[FETCH START] Iniciando busca para ${cacheKey}, forceRefresh: ${forceRefresh}`,
  );

  try {
    let data;

    // Verificar cache primeiro (a menos que forceRefresh)
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

    // Buscar da API se não tiver cache válido
    if (!data && (forceRefresh || shouldFetchFromApi(cacheKey))) {
      console.log("Buscando dados da API Football...");

      const rawData = await fetchFromApiWithRetry(finalUrl, {
        "X-Auth-Token": apiKey,
        "User-Agent": "netlify-function/1.0",
      });

      console.log("Dados recebidos da API com sucesso!");

      // Processar e normalizar dados
      data = processApiData(rawData);

      // Armazenar no cache
      cache.set(cacheKey, {
        data: data,
        timestamp: Date.now(),
      });

      console.log(`[CACHE STORED] Dados armazenados em cache para ${cacheKey}`);
    } else if (!data) {
      // Rate limited ou erro, tentar buscar do cache mesmo expirado
      if (cache.has(cacheKey)) {
        const cachedEntry = cache.get(cacheKey);
        const age = Date.now() - cachedEntry.timestamp;
        console.log(
          `[CACHE FALLBACK] Usando cache expirado (${Math.floor(
            age / 1000,
          )}s atrás) devido ao rate limiting`,
        );
        data = cachedEntry.data;
      } else {
        throw new Error("Dados não disponíveis e não há cache de fallback");
      }
    }

    // Limpar cache antigo (manter apenas os últimos 10 itens)
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
          cached: !forceRefresh && cache.has(cacheKey),
          cacheKey,
          timestamp: new Date().toISOString(),
        },
      }),
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30", // Cache do navegador por 30 segundos
      },
    };
  } catch (error) {
    console.error("Erro no fetch:", error.message);
    console.error("Stack trace:", error.stack);

    // Tentar fallback do cache mesmo em caso de erro
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
