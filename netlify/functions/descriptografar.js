require('dotenv').config();
const CryptoJS = require("crypto-js");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Método não permitido" }),
    };
  }

  try {
    const { textoCriptografado } = JSON.parse(event.body);
    const chave = process.env.CRYPTO_KEY;

    if (!chave) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Chave de criptografia não configurada" }),
      };
    }

    const bytes = CryptoJS.AES.decrypt(textoCriptografado, chave);
    const textoDescriptografado = bytes.toString(CryptoJS.enc.Utf8);

    if (!textoDescriptografado) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Falha ao descriptografar o texto" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ textoDescriptografado }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erro ao processar a descriptografia" }),
    };
  }
};
