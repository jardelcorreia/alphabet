# AlphaBet

## Descrição

AlphaBet é uma aplicação web de apostas focada nos jogos da Série A do Campeonato Brasileiro de futebol. Permite que usuários façam login, registrem suas apostas para as partidas, acompanhem um calendário de jogos e visualizem um ranking entre os jogadores.

## Funcionalidades Principais

*   **Login de Usuário:** Sistema de autenticação para identificação dos usuários.
*   **Tabela de Apostas:** Interface para os usuários inserirem seus palpites para os jogos de cada rodada.
*   **Calendário de Jogos:** Exibe as próximas partidas e resultados anteriores, consumindo dados de uma API externa (`api.football-data.org`).
*   **Ranking de Jogadores:** Mostra a pontuação e a classificação dos participantes com base em seus acertos.
*   **Modo Escuro:** Opção para alternar a interface entre temas claro e escuro para melhor conforto visual.

## Tecnologias Utilizadas

*   **Frontend:** HTML5, CSS3, JavaScript (ES6+)
*   **Backend (Serverless):** Netlify Functions
*   **Banco de Dados:** Supabase (para armazenamento de dados da aplicação, como apostas e ranking)
*   **Criptografia:** `crypto-js` (utilizada nas Netlify Functions para descriptografia de senhas)
*   **Variáveis de Ambiente:** `dotenv` (para gerenciamento de configurações sensíveis)
*   **API de Dados Esportivos:** `api.football-data.org` (para obter informações sobre as partidas)

## Como Executar o Projeto Localmente

1.  **Clonar o Repositório:**
    ```bash
    git clone <url-do-repositorio>
    cd <nome-do-diretorio>
    ```

2.  **Configurar Variáveis de Ambiente:**
    *   Crie um arquivo chamado `.env` na raiz do projeto.
    *   Adicione as seguintes variáveis de ambiente ao arquivo `.env`:
        ```
        SUPABASE_URL=SUA_SUPABASE_URL
        SUPABASE_ANON_KEY=SUA_SUPABASE_ANON_KEY
        CRYPTO_KEY=SUA_CHAVE_SECRETA_FORTE_PARA_CRIPTO
        FOOTBALL_DATA_API_KEY=SUA_CHAVE_DA_API_FOOTBALL_DATA
        ```
    *   Estas variáveis são essenciais para a conexão com o Supabase e para o funcionamento correto das Netlify Functions.

3.  **Instalar Dependências (se houver scripts de build ou pacotes Node.js além dos já incluídos):**
    *   O projeto utiliza `crypto-js` e `dotenv`, que estão listados no `package.json`. Se você for modificar ou adicionar funcionalidades que exijam outras dependências Node.js para as Netlify Functions, pode ser necessário executar:
        ```bash
        npm install
        ```

4.  **Executar com Netlify Dev:**
    *   Para simular o ambiente Netlify localmente e testar as Netlify Functions, utilize o Netlify CLI:
        ```bash
        netlify dev
        ```
    *   Isso iniciará um servidor local. Você poderá acessar o `index.html` através do endereço fornecido pelo `netlify dev` (geralmente `http://localhost:8888`).

## Configuração

Para o correto funcionamento do AlphaBet, as seguintes variáveis de ambiente precisam ser configuradas (seja em um arquivo `.env` para desenvolvimento local ou nas configurações de ambiente da sua plataforma de hospedagem, como a Netlify):

*   `SUPABASE_URL`: A URL do seu projeto Supabase.
*   `SUPABASE_ANON_KEY`: A chave anônima (anon key) do seu projeto Supabase.
*   `CRYPTO_KEY`: Uma chave secreta **forte e única** utilizada pela função `descriptografar.js` para decifrar as senhas dos usuários. **Esta chave é crítica para a segurança.**
*   `FOOTBALL_DATA_API_KEY`: Sua chave de API para `api.football-data.org`. Você pode precisar se registrar no site deles para obter uma chave válida.

## Netlify Functions

O backend serverless do projeto é construído com Netlify Functions:

*   **`descriptografar.js`**: Responsável por descriptografar a senha enviada pelo usuário durante o login, usando a `CRYPTO_KEY`.
*   **`senhas.js`**: Atualmente, esta função retorna um objeto com nomes de usuário e suas respectivas senhas criptografadas de forma hardcoded. **Nota:** Esta é uma implementação simplificada e deve ser substituída por um sistema de gerenciamento de usuários mais seguro, armazenando hashes de senhas em um banco de dados (veja Observações de Segurança).
*   **`fetchMatches.js`**: Busca os dados das partidas de futebol (calendário, resultados) da API `api.football-data.org`.

## Observações de Segurança Importantes

*   **Proteja sua `CRYPTO_KEY`:** Esta chave é vital. Se comprometida, todas as senhas criptografadas armazenadas podem ser decifradas. Garanta que ela seja forte, única e mantida em segredo nas configurações de ambiente da sua hospedagem.
*   **Melhoria no Armazenamento de Senhas:** A abordagem atual de armazenar senhas criptografadas em `senhas.js` e descriptografá-las não é a ideal para segurança. Recomenda-se fortemente a migração para o armazenamento de **hashes de senha** (utilizando algoritmos como Argon2 ou bcrypt) no banco de dados Supabase.
*   **Considere o Supabase Auth:** Para um gerenciamento de usuários (cadastro, login, recuperação de senha) mais robusto, seguro e completo, avalie a utilização do sistema de autenticação integrado do Supabase (`supabase.auth`). Ele já implementa as melhores práticas de segurança para senhas.

## Contribuições

Contribuições são bem-vindas! Sinta-se à vontade para abrir uma *issue* para relatar problemas ou sugerir melhorias, ou enviar um *pull request* com suas implementações.

## Licença

Recomenda-se a utilização da [MIT License](https://opensource.org/licenses/MIT). (Este é um placeholder, sinta-se à vontade para alterar ou remover se desejar).
