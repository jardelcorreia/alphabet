exports.handler = async () => {
  const url = "https://api.football-data.org/v4/competitions/BSA/matches";
  const apiKey = process.env.FOOTBALL_DATA_API_KEY; // Sua API Key

  console.log("Iniciando a busca dos dados da API Football...");

  try {
    const response = await fetch(url, {
      headers: {
        "X-Auth-Token": apiKey,
      },
    });

    console.log("Status da resposta da API:", response.status);

    if (!response.ok) {
      console.log("Erro ao buscar dados da API Football");
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "Erro ao buscar dados da API" }),
      };
    }

    const data = await response.json();
    console.log("Dados recebidos da API com sucesso!");

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Erro no fetch:", error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Erro interno do servidor",
        details: error.message,
      }),
    };
  }
};
