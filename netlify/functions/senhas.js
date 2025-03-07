exports.handler = async (event, context) => {
    // Senhas criptografadas (substitua pelos valores que você gerou)
    const senhasCriptografadas = {
      Jardel: "U2FsdGVkX1/kdazYVnQYtdxrejj/llx4W+v/dnbXvHE=",
      Werbet: "U2FsdGVkX19/TGyRq/pZEzBcqlUzOjksB8qJ6VSyr1Q=",
      Nailton: "U2FsdGVkX18v/Pv6R5bjotoKzHpe2yD9bg7/iGdIp0o=",
      Phillipe: "U2FsdGVkX1/A6/qFX50fRpb+YoYBd7ElBetNYg7jWOs=",
    };
  
    // Retorna as senhas criptografadas
    return {
      statusCode: 200,
      body: JSON.stringify(senhasCriptografadas),
    };
  };