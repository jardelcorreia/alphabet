exports.handler = async (event, context) => {
  const url = "https://api.football-data.org/v4/competitions/BSA/matches";
  const apiKey = "5f121390e2cc480d8d0f8dba3b37a435"; // Your API key

  try {
    const response = await fetch(url, {
      headers: {
        "X-Auth-Token": apiKey,
      },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "Erro ao buscar dados da API" }),
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erro interno do servidor" }),
    };
  }
};
