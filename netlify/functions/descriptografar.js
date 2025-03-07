const CryptoJS = require("crypto-js");

exports.handler = async (event, context) => {
  // Verifica se a requisição é POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Método não permitido",
    };
  }

  // Obtém os dados criptografados do corpo da requisição
  const { dataCriptografada } = JSON.parse(event.body);

  // Obtém a chave criptográfica das variáveis de ambiente
  const chave = process.env.CRYPTO_KEY;

  // Descriptografa os dados
  const bytes = CryptoJS.AES.decrypt(dataCriptografada, chave);
  const dadosDescriptografados = bytes.toString(CryptoJS.enc.Utf8);

  // Retorna os dados descriptografados
  return {
    statusCode: 200,
    body: JSON.stringify({ dadosDescriptografados }),
  };
};