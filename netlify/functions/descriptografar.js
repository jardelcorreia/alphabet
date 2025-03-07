const CryptoJS = require("crypto-js");

exports.handler = async (event, context) => {
  // Verifica se a requisição é POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Método não permitido" }),
    };
  }

  try {
    // Obtém os dados criptografados do corpo da requisição
    const { textoCriptografado } = JSON.parse(event.body);

    // Obtém a chave criptográfica das variáveis de ambiente
    const chave = process.env.CRYPTO_KEY;

    // Descriptografa os dados
    const bytes = CryptoJS.AES.decrypt(textoCriptografado, chave);
    const textoDescriptografado = bytes.toString(CryptoJS.enc.Utf8);

    // Retorna os dados descriptografados
    return {
      statusCode: 200,
      body: JSON.stringify({ textoDescriptografado }),
    };
  } catch (error) {
    // Retorna um erro em caso de falha
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erro ao descriptografar" }),
    };
  }
};