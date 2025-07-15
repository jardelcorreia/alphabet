// Função Netlify melhorada para buscar dados da Football API
// Versão com detecção inteligente de status e invalidação de cache

// Cache em memória para reduzir chamadas à API
const cache = new Map();
const lastApiCall = new Map();

// Configurações de cache baseadas no status dos jogos
const getCacheTTL = (matches) => {
  if (!matches || matches.length === 0) return 5 * 60 * 1000; // 5 minutos se não há jogos
  
  const hasLiveGames = matches.some(match => 
    ['IN_PLAY', 'PAUSED', 'HALFTIME'].includes(match.status?.toUpperCase())
  );
  
  const hasFinishedGames = matches.some(match => 
    match.status?.toUpperCase() === 'FINISHED'
  );
  
  const hasScheduledGames = matches.some(match => 
    ['SCHEDULED', 'TIMED'].includes(match.status?.toUpperCase())
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

// Controle de rate limiting mais inteligente
const shouldFetchFromApi = (cacheKey, hasLiveGames = false) => {
  const last = lastApiCall.get(cacheKey);
  // Reduzir intervalo mínimo se há jogos ao vivo
  const MIN_INTERVAL = hasLiveGames ? 20000 : 30000; // 20s para jogos ao vivo, 30s normal
  
  if (!last || (Date.now() - last) > MIN_INTERVAL) {
    lastApiCall.set(cacheKey, Date.now());
    return true;
  }
  
  console.log(`[RATE LIMIT] Bloqueando chamada para ${cacheKey}, última chamada há ${Date.now() - last}ms`);
  return false;
};

// Função para buscar dados da API com retry e backoff exponencial
const fetchFromApiWithRetry = async (url, headers, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[API CALL] Tentativa ${attempt}/${maxRetries} para ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log(`[API RESPONSE] Status: ${response.status}`);
      
      if (response.ok) {
        return await response.json();
      }
      
      // Tratamento específico para rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || (attempt * 3);
        console.log(`[RATE LIMITED] Aguardando ${retryAfter}s antes da próxima tentativa`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      // Outros erros HTTP
      const errorText = await response.text();
      console.error(`[API ERROR] ${response.status}: ${errorText}`);
      
      if (response.status >= 500 && attempt < maxRetries) {
        // Erro do servidor, tentar novamente
        const delay = Math.pow(2, attempt) * 1000; // Backoff exponencial
        console.log(`[RETRY] Erro do servidor, tentando novamente em ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
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
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Detectar se jogo deveria estar finalizado baseado em tempo
const shouldGameBeFinished = (match) => {
  const matchDate = new Date(match.utcDate);
  const now = new Date();
  
  // Jogo com mais de 2 horas já deveria estar finalizado
  const gameOverTime = 2 * 60 * 60 * 1000; // 2 horas em ms
  
  if (matchDate < now && (now - matchDate) > gameOverTime) {
    return true;
  }
  
  return false;
};

// Normalizar e estabilizar status dos jogos com detecção inteligente
const normalizeMatchStatus = (match, previousMatch = null) => {
  const originalStatus = match.status;
  const matchDate = new Date(match.utcDate);
  const now = new Date();
  
  // Manter status original se já estiver normalizado
  if (!originalStatus) {
    return { ...match, status: 'SCHEDULED', statusSource: 'normalized' };
  }
  
  const upperStatus = originalStatus.toUpperCase();
  
  // Detectar se o jogo deveria estar finalizado
  const shouldBeFinished = shouldGameBeFinished(match);
  
  // Log para debug
  if (shouldBeFinished && upperStatus === 'IN_PLAY') {
    console.warn(`[STATUS DETECTION] Jogo ${match.id} ainda em IN_PLAY mas deveria estar finalizado (${matchDate.toISOString()})`);
  }
  
  // Regras de normalização melhoradas
  switch (upperStatus) {
    case 'FINISHED':
      return { ...match, status: 'FINISHED', statusSource: 'stable' };
    
    case 'IN_PLAY':
    case 'PAUSED':
    case 'HALFTIME':
      // Se o jogo deveria estar finalizado, marcar como suspeito
      if (shouldBeFinished) {
        console.warn(`[STATUS SUSPECT] Jogo ${match.id} em ${upperStatus} mas passou tempo esperado`);
        return { 
          ...match, 
          status: 'IN_PLAY', 
          statusSource: 'suspect',
          suspectReason: 'overtime_detected',
          matchAge: now - matchDate
        };
      }
      return { ...match, status: 'IN_PLAY', statusSource: 'live' };
    
    case 'SCHEDULED':
    case 'TIMED':
      // Verificar se o jogo não deveria estar finalizado
      if (shouldBeFinished) {
        console.warn(`[STATUS WARNING] Jogo ${match.id} agendado mas já passou tempo esperado: ${matchDate.toISOString()}`);
        return { 
          ...match, 
          status: 'SCHEDULED', 
          statusSource: 'outdated',
          suspectReason: 'should_be_finished'
        };
      }
      return { ...match, status: 'SCHEDULED', statusSource: 'normalized' };
    
    case 'POSTPONED':
      return { ...match, status: 'POSTPONED', statusSource: 'stable' };
    
    case 'SUSPENDED':
      return { ...match, status: 'SUSPENDED', statusSource: 'stable' };
    
    case 'CANCELLED':
      return { ...match, status: 'CANCELLED', statusSource: 'stable' };
    
    default:
      console.warn(`[STATUS UNKNOWN] Status desconhecido: ${originalStatus}, normalizando para SCHEDULED`);
      return { ...match, status: 'SCHEDULED', statusSource: 'fallback' };
  }
};

// Detectar se cache precisa ser invalidado
const shouldInvalidateCache = (cachedData, newData) => {
  if (!cachedData || !newData) return false;
  
  const cachedMatches = cachedData.matches || [];
  const newMatches = newData.matches || [];
  
  // Comparar status dos jogos
  for (let i = 0; i < Math.min(cachedMatches.length, newMatches.length); i++) {
    const cachedMatch = cachedMatches[i];
    const newMatch = newMatches[i];
    
    if (cachedMatch.status !== newMatch.status) {
      console.log(`[CACHE INVALIDATION] Status mudou para jogo ${newMatch.id}: ${cachedMatch.status} -> ${newMatch.status}`);
      return true;
    }
    
    // Verificar se score mudou
    if (cachedMatch.score?.fullTime?.homeTeam !== newMatch.score?.fullTime?.homeTeam ||
        cachedMatch.score?.fullTime?.awayTeam !== newMatch.score?.fullTime?.awayTeam) {
      console.log(`[CACHE INVALIDATION] Score mudou para jogo ${newMatch.id}`);
      return true;
    }
  }
  
  return false;
};

// Processar e normalizar dados da API
const processApiData = (data, previousData = null) => {
  if (!data || !data.matches) {
    return data;
  }
  
  const processedMatches = data.matches.map((match, index) => {
    const previousMatch = previousData?.matches?.[index];
    return normalizeMatchStatus(match, previousMatch);
  });
  
  // Estatísticas de processamento
  const statusStats = {};
  const suspectGames = [];
  
  processedMatches.forEach(match => {
    const status = match.status;
    statusStats[status] = (statusStats[status] || 0) + 1;
    
    if (match.statusSource === 'suspect') {
      suspectGames.push({
        id: match.id,
        homeTeam: match.homeTeam?.name,
        awayTeam: match.awayTeam?.name,
        status: match.status,
        reason: match.suspectReason,
        matchAge: match.matchAge
      });
    }
  });
  
  console.log('[PROCESSING] Estatísticas de status:', statusStats);
  
  if (suspectGames.length > 0) {
    console.warn('[PROCESSING] Jogos com status suspeito:', suspectGames);
  }
  
  return {
    ...data,
    matches: processedMatches,
    processing: {
      total: processedMatches.length,
      statusStats,
      suspectGames,
      processedAt: new Date().toISOString()
    }
  };
};

// Função principal
exports.handler = async (event, context) => {
  const url = "https://api.football-data.org/v4/competitions/BSA/matches";
  const apiKey = "5f121390e2cc480d8d0f8dba3b37a435";
  
  // Parâmetros opcionais
  const forceRefresh = event.queryStringParameters?.forceRefresh === 'true';
  const round = event.queryStringParameters?.round;
  const invalidateCache = event.queryStringParameters?.invalidateCache === 'true';
  
  // Construir URL com parâmetros
  let finalUrl = url;
  if (round) {
    finalUrl += `?matchday=${round}`;
  }
  
  const cacheKey = `BSA_${round || 'all'}`;
  
  console.log(`[FETCH START] Iniciando busca para ${cacheKey}, forceRefresh: ${forceRefresh}, invalidateCache: ${invalidateCache}`);
  
  try {
    let data;
    let cachedData = null;
    
    // Invalidar cache se solicitado
    if (invalidateCache && cache.has(cacheKey)) {
      console.log(`[CACHE INVALIDATED] Cache invalidado manualmente para ${cacheKey}`);
      cache.delete(cacheKey);
    }
    
    // Verificar cache primeiro (a menos que forceRefresh)
    if (!forceRefresh && cache.has(cacheKey)) {
      const cachedEntry = cache.get(cacheKey);
      const age = Date.now() - cachedEntry.timestamp;
      const ttl = getCacheTTL(cachedEntry.data.matches);
      
      if (age < ttl) {
        console.log(`[CACHE HIT] Usando dados em cache (${Math.floor(age/1000)}s atrás, TTL: ${Math.floor(ttl/1000)}s)`);
        data = cachedEntry.data;
        cachedData = cachedEntry.data;
        
        // Verificar se há jogos suspeitos que precisam de atualização
        const suspectGames = data.processing?.suspectGames || [];
        if (suspectGames.length > 0) {
          console.log(`[CACHE CHECK] Encontrados ${suspectGames.length} jogos suspeitos, forçando atualização`);
          data = null; // Forçar busca na API
        }
      } else {
        console.log(`[CACHE EXPIRED] Cache expirado (${Math.floor(age/1000)}s > ${Math.floor(ttl/1000)}s)`);
        cachedData = cachedEntry.data;
        cache.delete(cacheKey);
      }
    }
    
    // Verificar se há jogos ao vivo para ajustar rate limiting
    const hasLiveGames = cachedData?.matches?.some(match => 
      ['IN_PLAY', 'PAUSED', 'HALFTIME'].includes(match.status?.toUpperCase())
    ) || false;
    
    // Buscar da API se não tiver cache válido
    if (!data && (forceRefresh || shouldFetchFromApi(cacheKey, hasLiveGames))) {
      console.log("Buscando dados da API Football...");
      
      const rawData = await fetchFromApiWithRetry(finalUrl, {
        "X-Auth-Token": apiKey,
        "User-Agent": "netlify-function/1.0"
      });
      
      console.log("Dados recebidos da API com sucesso!");
      
      // Processar e normalizar dados
      data = processApiData(rawData, cachedData);
      
      // Verificar se o cache deveria ser invalidado
      if (cachedData && shouldInvalidateCache(cachedData, data)) {
        console.log("[CACHE] Invalidação automática detectada");
      }
      
      // Armazenar no cache
      cache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });
      
      console.log(`[CACHE STORED] Dados armazenados em cache para ${cacheKey}`);
      
    } else if (!data) {
      // Rate limited ou erro, tentar buscar do cache mesmo expirado
      if (cache.has(cacheKey)) {
        const cachedEntry = cache.get(cacheKey);
        const age = Date.now() - cachedEntry.timestamp;
        console.log(`[CACHE FALLBACK] Usando cache expirado (${Math.floor(age/1000)}s atrás) devido ao rate limiting`);
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
          hasLiveGames,
          timestamp: new Date().toISOString()
        }
      }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': hasLiveGames ? 'public, max-age=20' : 'public, max-age=30'
      }
    };
    
  } catch (error) {
    console.error("Erro no fetch:", error.message);
    console.error("Stack trace:", error.stack);
    
    // Tentar fallback do cache mesmo em caso de erro
    if (cache.has(cacheKey)) {
      const cachedEntry = cache.get(cacheKey);
      const age = Date.now() - cachedEntry.timestamp;
      console.log(`[ERROR FALLBACK] Usando cache de emergência (${Math.floor(age/1000)}s atrás)`);
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          ...cachedEntry.data,
          meta: {
            cached: true,
            fallback: true,
            error: error.message,
            cacheAge: age,
            timestamp: new Date().toISOString()
          }
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Fallback': 'true'
        }
      };
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Erro interno do servidor",
        details: process.env.NODE_ENV === 'development' ? error.message : 'Erro ao buscar dados da API',
        timestamp: new Date().toISOString()
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }
};
