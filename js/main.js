// Configurações iniciais
const SUPABASE_URL = "https://leuyfasvbfwdaloapmrs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxldXlmYXN2YmZ3ZGFsb2FwbXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExMTczMzUsImV4cCI6MjA1NjY5MzMzNX0.Y_s-KMy9n_Ht2OVaxmQEjnDRniqJ_DcppQVam7uAGk4";
const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Variáveis globais
let todasPartidas = [];
let rodadaAtual = 1;
let totalRodadas = 0;
let rodadaExibida = null;
let partidasPorRodada = {};
let intervaloAtualizacao = null;

// Mapeamento de times
const timesInfo = {
  "SE Palmeiras": {
    abrev: "PAL",
    nome: "Palmeiras",
    escudo:
      "https://logodetimes.com/times/palmeiras/logo-palmeiras-256.png",
  },
  "Botafogo FR": {
    abrev: "BOT",
    nome: "Botafogo",
    escudo:
      "https://logodetimes.com/times/botafogo/logo-botafogo-256.png",
  },
  "CR Flamengo": {
    abrev: "FLA",
    nome: "Flamengo",
    escudo:
      "https://logodetimes.com/times/flamengo/logo-flamengo-256.png",
  },
  "Fluminense FC": {
    abrev: "FLU",
    nome: "Fluminense",
    escudo:
      "https://logodetimes.com/times/fluminense/logo-fluminense-256.png",
  },
  "Grêmio FBPA": {
    abrev: "GRE",
    nome: "Grêmio",
    escudo: "https://logodetimes.com/times/gremio/logo-gremio-256.png",
  },
  "São Paulo FC": {
    abrev: "SAO",
    nome: "São Paulo",
    escudo:
      "https://logodetimes.com/times/sao-paulo/logo-sao-paulo-256.png",
  },
  "CA Mineiro": {
    abrev: "CAM",
    nome: "Atlético-MG",
    escudo:
      "https://logodetimes.com/times/atletico-mineiro/logo-atletico-mineiro-256.png",
  },
  "SC Recife": {
    abrev: "SPT",
    nome: "Sport",
    escudo:
      "https://logodetimes.com/times/sport-recife/logo-sport-recife-256.png",
  },
  "SC Internacional": {
    abrev: "INT",
    nome: "Internacional",
    escudo:
      "https://logodetimes.com/times/internacional/logo-internacional-256.png",
  },
  "Cruzeiro EC": {
    abrev: "CRU",
    nome: "Cruzeiro",
    escudo:
      "https://logodetimes.com/times/cruzeiro/logo-cruzeiro-256.png",
  },
  "SC Corinthians Paulista": {
    abrev: "COR",
    nome: "Corinthians",
    escudo:
      "https://logodetimes.com/times/corinthians/logo-corinthians-256.png",
  },
  "Santos FC": {
    abrev: "SAN",
    nome: "Santos",
    escudo: "https://logodetimes.com/times/santos/logo-santos-256.png",
  },
  "EC Bahia": {
    abrev: "BAH",
    nome: "Bahia",
    escudo: "https://logodetimes.com/times/bahia/logo-bahia-256.png",
  },
  "CR Vasco da Gama": {
    abrev: "VAS",
    nome: "Vasco",
    escudo:
      "https://logodetimes.com/times/vasco-da-gama/logo-vasco-da-gama-256.png",
  },
  "Mirassol FC": {
    abrev: "MIR",
    nome: "Mirassol",
    escudo:
      "https://logodetimes.com/times/mirassol/logo-mirassol-256.png",
  },
  "EC Juventude": {
    abrev: "JUV",
    nome: "Juventude",
    escudo:
      "https://logodetimes.com/times/juventude/logo-juventude-256.png",
  },
  "Ceará SC": {
    abrev: "CEA",
    nome: "Ceará",
    escudo: "https://logodetimes.com/times/ceara/logo-ceara-256.png",
  },
  "Fortaleza EC": {
    abrev: "FOR",
    nome: "Fortaleza",
    escudo:
      "https://logodetimes.com/times/fortaleza/logo-fortaleza-256.png",
  },
  "RB Bragantino": {
    abrev: "RBB",
    nome: "RB Bragantino",
    escudo:
      "https://logodetimes.com/times/red-bull-bragantino/logo-red-bull-bragantino-256.png",
  },
  "EC Vitória": {
    abrev: "VIT",
    nome: "Vitória",
    escudo:
      "https://logodetimes.com/times/vitoria/logo-vitoria-256.png",
  },
};

// Inicialização da página
document.addEventListener("DOMContentLoaded", async function () {
  const loggedInUser = localStorage.getItem("loggedInUser");
  if (loggedInUser) {
    document.getElementById("login-container").classList.add("hidden");
    document.getElementById("main-content").classList.remove("hidden");
    initializeDarkMode();
    createAdvancedTitle();
    criarLinhasTabela();
    adicionarEventos();
    // Inicia a atualização automática imediatamente
    iniciarAtualizacaoAutomatica();
    await verificarEstadoPlacares();
    await verificarPermissoesUsuario();
    await carregarApostas();
    await buscarCalendario();
  }
});

// Funções de login/logout
function handleKeyPress(event) {
  if (event.key === "Enter") login();
}

async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const response = await fetch("/.netlify/functions/senhas");
    if (!response.ok) throw new Error("Erro ao buscar senhas");
    const senhasCriptografadas = await response.json();

    if (senhasCriptografadas[username]) {
      const descriptResponse = await fetch(
        "/.netlify/functions/descriptografar",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            textoCriptografado: senhasCriptografadas[username],
          }),
        }
      );

      if (!descriptResponse.ok)
        throw new Error("Erro ao descriptografar");
      const { textoDescriptografado } = await descriptResponse.json();

      if (textoDescriptografado === password) {
        localStorage.setItem("loggedInUser", username);
        document
          .getElementById("login-container")
          .classList.add("hidden");
        document
          .getElementById("main-content")
          .classList.remove("hidden");
        initializeDarkMode();
        createAdvancedTitle();
        criarLinhasTabela();
        adicionarEventos();
        await verificarEstadoPlacares();
        await verificarPermissoesUsuario();
        await carregarApostas();
        await buscarCalendario();
      } else {
        alert("Nome de usuário ou senha incorretos!");
      }
    } else {
      alert("Nome de usuário ou senha incorretos!");
    }
  } catch (error) {
    console.error("Erro no login:", error);
    alert("Erro ao fazer login. Tente novamente.");
  }
}

function logout() {
  localStorage.removeItem("loggedInUser");
  document.getElementById("login-container").classList.remove("hidden");
  document.getElementById("main-content").classList.add("hidden");
  pararAtualizacaoAutomatica();
}

// Funções de UI
function createAdvancedTitle() {
  const titulo = "Brasileirão AlphaBet 2025";
  const containerTitulo = document.querySelector(".container-titulo");
  containerTitulo.innerHTML = "";

  const palavras = titulo.split(" ");
  palavras.forEach((palavra, wordIndex) => {
    const wordWrapper = document.createElement("div");
    wordWrapper.style.display = "inline-flex";
    wordWrapper.style.margin = "0 0.25rem";

    palavra.split("").forEach((letra, letterIndex) => {
      const span = document.createElement("span");
      span.textContent = letra;
      span.classList.add("letra");
      span.style.animationDelay = `${
        (wordIndex * palavra.length + letterIndex) * 0.1
      }s`;
      span.style.animationDuration = `${0.8 + Math.random() * 0.2}s`;
      wordWrapper.appendChild(span);
    });

    containerTitulo.appendChild(wordWrapper);
  });
}

function initializeDarkMode() {
  const darkModeToggle = document.getElementById("toggle-dark-mode");
  const isDarkMode = localStorage.getItem("darkMode") === "true";

  if (isDarkMode) {
    document.body.classList.add("dark-mode");
    darkModeToggle.textContent = "☀️ Light";
  } else {
    document.body.classList.remove("dark-mode");
    darkModeToggle.textContent = "🌙 Dark";
  }

  darkModeToggle.addEventListener("click", function () {
    document.body.classList.toggle("dark-mode");
    const isDarkModeNow = document.body.classList.contains("dark-mode");
    localStorage.setItem("darkMode", isDarkModeNow);
    this.textContent = isDarkModeNow ? "☀️ Light" : "🌙 Dark";
  });
}

// Funções de tabela de apostas
function criarLinhasTabela() {
  const tabela = document.getElementById("tabela-apostas");
  for (let i = 1; i <= 10; i++) {
    const linha = document.createElement("tr");
    linha.innerHTML = `
<td><input type="text" class="input-jogo" placeholder="casa x fora"></td>
${["Jardel", "Werbet", "Nailton", "Phillipe"]
  .map(
    (jogador, jogadorIndex) => `
  <td>
    <div class="input-container">
      <input type="number" class="aposta input-placar jogador${jogadorIndex}" min="0">
      <span class="placar-separador">x</span>
      <input type="number" class="aposta input-placar jogador${jogadorIndex}" min="0">
    </div>
  </td>
`
  )
  .join("")}
<td>
  <div class="input-container">
    <input type="number" class="resultado input-placar" min="0">
    <span class="placar-separador">x</span>
    <input type="number" class="resultado input-placar" min="0">
  </div>
</td>
`;
    tabela.appendChild(linha);
  }
}

function adicionarEventos() {
  adicionarNavegacao();
  adicionarNavegacaoJogos();
  adicionarEventosSalvamento();
  adicionarEventosCalculoPontuacao();

  document
    .getElementById("nome-rodada")
    .addEventListener("input", salvarApostasDebounced);
  document
    .getElementById("preencher-tabela-principal")
    .addEventListener("click", () => {
      if (typeof rodadaAtual !== "undefined") {
        preencherTabelaPrincipalComRodadaAtual(rodadaAtual);
      } else {
        alert(
          "Por favor, aguarde até que os dados do calendário sejam carregados."
        );
      }
    });

  document.getElementById("anterior").addEventListener("click", () => {
    if (rodadaAtual > 1) {
      rodadaAtual--;
      exibirRodada(rodadaAtual, partidasPorRodada[rodadaAtual]);
      atualizarNavegacao();
    }
  });

  document.getElementById("proxima").addEventListener("click", () => {
    if (rodadaAtual < totalRodadas) {
      rodadaAtual++;
      exibirRodada(rodadaAtual, partidasPorRodada[rodadaAtual]);
      atualizarNavegacao();
    }
  });
}

function adicionarNavegacao() {
  for (let i = 0; i < 4; i++) {
    const coluna = document.querySelectorAll(`input.jogador${i}`);
    coluna.forEach((input, index) => {
      input.addEventListener("input", (event) => {
        if (event.target.value.length === 1) {
          let nextIndex = index + 1;
          if (nextIndex < coluna.length) coluna[nextIndex].focus();
        }
      });

      input.addEventListener("keydown", (event) => {
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          if (input.value === "") {
            const prevIndex = index - 1;
            if (prevIndex >= 0) coluna[prevIndex].focus();
          } else {
            input.value = "";
          }
        }
      });
    });
  }

  const placarReal = document.querySelectorAll("input.resultado");
  placarReal.forEach((input, index) => {
    input.addEventListener("input", (event) => {
      if (event.target.value.length === 1) {
        let nextIndex = index + 1;
        if (nextIndex < placarReal.length)
          placarReal[nextIndex].focus();
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (input.value === "") {
          const prevIndex = index - 1;
          if (prevIndex >= 0) placarReal[prevIndex].focus();
        } else {
          input.value = "";
        }
      }
    });
  });
}

function adicionarNavegacaoJogos() {
  const inputsJogos = document.querySelectorAll(".input-jogo");
  inputsJogos.forEach((input, index) => {
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const nextIndex = index + 1;
        if (nextIndex < inputsJogos.length)
          inputsJogos[nextIndex].focus();
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (input.value.length > 0) {
          input.value = input.value.slice(0, -1);
        } else {
          const prevIndex = index - 1;
          if (prevIndex >= 0) inputsJogos[prevIndex].focus();
        }
      }
    });
  });
}

// Funções de salvamento
const salvarApostasDebounced = debounce(salvarApostas, 500);

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

async function salvarApostas() {
  try {
    const { data, error: fetchError } = await supabaseClient
      .from("alphabet_table")
      .select("*")
      .order("id", { ascending: false })
      .limit(1);

    if (fetchError) throw fetchError;

    const novosDados = {
      nome_rodada: document.getElementById("nome-rodada").value,
      jogos: obterJogosDaTabela(),
      apostas: obterApostasDaTabela(),
      resultados: obterResultadosDaTabela(),
      placares_ocultos: await carregarEstadoVisibilidade(),
    };

    if (!data || data.length === 0) {
      novosDados.ranking = {};
      novosDados.vitorias_empates = {};
      const { error: insertError } = await supabaseClient
        .from("alphabet_table")
        .insert(novosDados);
      if (insertError) throw insertError;
    } else {
      const { error: updateError } = await supabaseClient
        .from("alphabet_table")
        .update(novosDados)
        .eq("id", data[0].id);
      if (updateError) throw updateError;
    }
  } catch (error) {
    console.error("Erro ao salvar dados:", error);
  }
}

function obterJogosDaTabela() {
  const jogos = [];
  document
    .querySelectorAll(".input-jogo")
    .forEach((input) => jogos.push(input.value));
  return jogos;
}

function obterApostasDaTabela() {
  const apostas = { Jardel: [], Werbet: [], Nailton: [], Phillipe: [] };
  const inputs = document.querySelectorAll(".aposta");

  for (let i = 0; i < 10; i++) {
    apostas.Jardel.push({
      time1: inputs[i * 8].value,
      time2: inputs[i * 8 + 1].value,
    });
    apostas.Werbet.push({
      time1: inputs[i * 8 + 2].value,
      time2: inputs[i * 8 + 3].value,
    });
    apostas.Nailton.push({
      time1: inputs[i * 8 + 4].value,
      time2: inputs[i * 8 + 5].value,
    });
    apostas.Phillipe.push({
      time1: inputs[i * 8 + 6].value,
      time2: inputs[i * 8 + 7].value,
    });
  }

  return apostas;
}

function obterResultadosDaTabela() {
  const resultados = [];
  const inputs = document.querySelectorAll(".resultado");

  for (let i = 0; i < 10; i++) {
    resultados.push({
      time1: inputs[i * 2].value,
      time2: inputs[i * 2 + 1].value,
    });
  }

  return resultados;
}

function adicionarEventosSalvamento() {
  const inputs = document.querySelectorAll(
    ".aposta, .resultado, .input-jogo, #nome-rodada"
  );
  inputs.forEach((input) => {
    input.addEventListener("input", function () {
      salvarApostasDebounced();
      mostrarFeedbackApostasCompletas();
    });

    input.addEventListener("change", function () {
      salvarApostasDebounced();
      mostrarFeedbackApostasCompletas();
    });

    input.addEventListener("blur", function () {
      salvarApostasDebounced();
      mostrarFeedbackApostasCompletas();
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Delete" || event.key === "Backspace") {
        salvarApostasDebounced();
        mostrarFeedbackApostasCompletas();
      }
    });
  });
}

function verificarApostasCompletas() {
  const loggedInUser = localStorage.getItem("loggedInUser");
  if (!loggedInUser) return false;

  const jogadorClass =
    loggedInUser === "Jardel"
      ? "jogador0"
      : loggedInUser === "Werbet"
      ? "jogador1"
      : loggedInUser === "Nailton"
      ? "jogador2"
      : loggedInUser === "Phillipe"
      ? "jogador3"
      : null;

  if (!jogadorClass) return false;

  const inputsJogos = document.querySelectorAll('.input-jogo');
  const apostasUsuario = document.querySelectorAll(
    `.aposta.${jogadorClass}`
  );

  let todasApostasAplicaveisPreenchidas = true;

  for (let i = 0; i < 10; i++) {
    const currentGameInput = inputsJogos[i];
    const gameName = currentGameInput.value.trim();
    const gamePattern = /\S+\s*x\s*\S+/i;
    const isGameApplicable = gameName !== "" && !gameName.toLowerCase().includes("sem jogo") && gamePattern.test(gameName);

    if (isGameApplicable) {
      if (apostasUsuario[i * 2].value === "" || apostasUsuario[i * 2 + 1].value === "") {
        todasApostasAplicaveisPreenchidas = false;
        break;
      }
    }
  }

  return todasApostasAplicaveisPreenchidas;
}

function mostrarFeedbackApostasCompletas() {
  const feedback = document.getElementById("feedback-apostas");
  if (verificarApostasCompletas()) {
    feedback.classList.add("visible");
    setTimeout(() => feedback.classList.remove("visible"), 3000);
  }
}

// Funções de visibilidade
async function toggleVisibility() {
  const isHidden = await carregarEstadoVisibilidade();
  const novoEstado = !isHidden;
  await salvarEstadoVisibilidade(novoEstado);
  verificarEstadoPlacares();
}

function mostrarPlacares() {
  document.querySelectorAll(".aposta").forEach((input) => {
    input.style.display = "";
    input.disabled = true;
  });
}

function ocultarPlacares() {
  const loggedInUser = localStorage.getItem("loggedInUser");
  document.querySelectorAll(".aposta").forEach((input) => {
    const jogador = input.classList.contains("jogador0")
      ? "Jardel"
      : input.classList.contains("jogador1")
      ? "Werbet"
      : input.classList.contains("jogador2")
      ? "Nailton"
      : input.classList.contains("jogador3")
      ? "Phillipe"
      : null;

    if (jogador && jogador !== loggedInUser) {
      input.style.display = "none";
    } else {
      input.style.display = "";
      input.disabled = false;
    }
  });
}

async function salvarEstadoVisibilidade(estado) {
  try {
    const { data, error: fetchError } = await supabaseClient
      .from("alphabet_table")
      .select("*")
      .order("id", { ascending: false })
      .limit(1);

    if (fetchError) throw fetchError;

    if (!data || data.length === 0) {
      const { error: insertError } = await supabaseClient
        .from("alphabet_table")
        .insert({ placares_ocultos: estado });
      if (insertError) throw insertError;
    } else {
      const { error: updateError } = await supabaseClient
        .from("alphabet_table")
        .update({ placares_ocultos: estado })
        .eq("id", data[0].id);
      if (updateError) throw updateError;
    }
  } catch (error) {
    console.error("Erro ao salvar estado de visibilidade:", error);
  }
}

async function carregarEstadoVisibilidade() {
  try {
    const { data, error } = await supabaseClient
      .from("alphabet_table")
      .select("placares_ocultos")
      .order("id", { ascending: false })
      .limit(1);

    if (error) throw error;
    return data && data.length > 0 ? data[0].placares_ocultos : false;
  } catch (error) {
    console.error("Erro ao carregar estado de visibilidade:", error);
    return false;
  }
}

async function verificarEstadoPlacares() {
  try {
    const isHidden = await carregarEstadoVisibilidade();
    const toggleButton = document.getElementById("toggle-visibility");
    const toggleText = document.getElementById("toggle-text");

    const loggedInUser = localStorage.getItem("loggedInUser");
    toggleButton.classList.toggle("hidden", loggedInUser !== "Jardel");

    toggleText.textContent = isHidden
      ? "Mostrar Placar"
      : "Ocultar Placar";
    toggleButton.onclick = toggleVisibility;

    if (isHidden) ocultarPlacares();
    else mostrarPlacares();
  } catch (error) {
    console.error("Erro ao verificar estado dos placares:", error);
  }
}

async function verificarPermissoesUsuario() {
  try {
    const loggedInUser = localStorage.getItem("loggedInUser");
    const toggleButton = document.getElementById("toggle-visibility");
    const preencherTabelaButton = document.getElementById(
      "preencher-tabela-principal"
    );

    toggleButton.classList.toggle("hidden", loggedInUser !== "Jardel");
    preencherTabelaButton.classList.toggle(
      "hidden",
      loggedInUser !== "Jardel"
    );
  } catch (error) {
    console.error("Erro ao verificar permissões do usuário:", error);
  }
}

// Funções de pontuação
function calcularPontuacao() {
  const apostas = obterApostasDaTabela();
  const resultados = obterResultadosDaTabela();
  const jogadores = ["Jardel", "Werbet", "Nailton", "Phillipe"];
  const pontos = { Jardel: 0, Werbet: 0, Nailton: 0, Phillipe: 0 };
  const placaresExatos = {
    Jardel: 0,
    Werbet: 0,
    Nailton: 0,
    Phillipe: 0,
  };

  // Calcula pontos e placares exatos
  for (let i = 0; i < 10; i++) {
    const resultadoCasa = resultados[i].time1;
    const resultadoFora = resultados[i].time2;

    if (resultadoCasa === "" || resultadoFora === "") continue;

    jogadores.forEach((jogador) => {
      const apostaCasa = apostas[jogador][i].time1;
      const apostaFora = apostas[jogador][i].time2;

      if (apostaCasa === "" || apostaFora === "") return;

      if (
        apostaCasa === resultadoCasa &&
        apostaFora === resultadoFora
      ) {
        pontos[jogador] += 3;
        placaresExatos[jogador] += 1;
      } else if (
        (apostaCasa > apostaFora && resultadoCasa > resultadoFora) ||
        (apostaCasa < apostaFora && resultadoCasa < resultadoFora) ||
        (apostaCasa === apostaFora && resultadoCasa === resultadoFora)
      ) {
        pontos[jogador] += 1;
      }
    });
  }

  // Ordena por pontos e depois por placares exatos
  const jogadoresOrdenados = Object.entries(pontos).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // Ordem decrescente de pontos
    return placaresExatos[b[0]] - placaresExatos[a[0]]; // Desempate por placares exatos
  });

  // Verifica se há pontuação maior que zero
  const todosZerados = jogadoresOrdenados.every(
    ([_, pontuacao]) => pontuacao === 0
  );

  // Define o(s) vencedor(es) com base nos placares exatos em caso de empate
  let vencedores = [];
  if (!todosZerados) {
    const maiorPontuacao = jogadoresOrdenados[0][1];
    const jogadoresComMaiorPontuacao = jogadoresOrdenados.filter(
      ([_, pontuacao]) => pontuacao === maiorPontuacao
    );

    // Se houver empate, pega o(s) com mais placares exatos
    const maiorPlacarExato = Math.max(
      ...jogadoresComMaiorPontuacao.map(
        ([jogador]) => placaresExatos[jogador]
      )
    );
    vencedores = jogadoresComMaiorPontuacao.filter(
      ([jogador]) => placaresExatos[jogador] === maiorPlacarExato
    );
  }

  // Gera o HTML da pontuação
  const pontuacaoHTML = jogadoresOrdenados
    .map(([jogador, pontuacao]) => {
      const isVencedor = vencedores.some(
        ([vencedor]) => vencedor === jogador
      );
      return `
      <div class="pontuacao-card ${isVencedor ? "vencedor" : ""}">
        <h3>${jogador}</h3>
        <span>
          <p>${pontuacao} pontos</p>
          <p>Placares exatos: ${placaresExatos[jogador]}</p>
        </span>
      </div>
    `;
    })
    .join("");

  document.getElementById("pontuacao").innerHTML = pontuacaoHTML;
}

function adicionarEventosCalculoPontuacao() {
  const inputsApostas = document.querySelectorAll(".aposta");
  inputsApostas.forEach((input) => {
    input.addEventListener("input", function () {
      salvarApostasDebounced();
      calcularPontuacao();
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Delete" || event.key === "Backspace") {
        salvarApostasDebounced();
        calcularPontuacao();
      }
    });
  });

  const inputsResultados = document.querySelectorAll(".resultado");
  inputsResultados.forEach((input) => {
    input.addEventListener("input", function () {
      salvarApostasDebounced();
      calcularPontuacao();
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Delete" || event.key === "Backspace") {
        salvarApostasDebounced();
        calcularPontuacao();
      }
    });
  });
}

function abrirRanking() {
  window.open("ranking.html", "_blank");
}

// Funções do calendário de jogos
async function buscarCalendario() {
  try {
    const response = await fetch("/.netlify/functions/fetchMatches");
    if (!response.ok)
      throw new Error(`Erro de rede: ${response.status}`);

    const data = await response.json();
    todasPartidas = data.matches;

    partidasPorRodada = {};
    todasPartidas.forEach((partida) => {
      const rodada = partida.matchday;
      if (!partidasPorRodada[rodada]) partidasPorRodada[rodada] = [];
      partidasPorRodada[rodada].push(partida);
    });

    const todosOsNumerosDeRodadas = Object.keys(partidasPorRodada)
                                          .map(Number)
                                          .sort((a, b) => b - a); // Sort descending

    let rodadaParaExibir = todosOsNumerosDeRodadas.length > 0 ? todosOsNumerosDeRodadas[0] : 1;

    if (todosOsNumerosDeRodadas.length > 0) {
      for (const numeroRodada of todosOsNumerosDeRodadas) {
        const jogosDaRodada = partidasPorRodada[numeroRodada];
        const temJogoNaoFinalizado = jogosDaRodada.some(jogo => jogo.status !== "FINISHED");
        if (temJogoNaoFinalizado) {
          rodadaParaExibir = numeroRodada;
          break;
        }
      }
    }

    totalRodadas = todosOsNumerosDeRodadas.length > 0 ? todosOsNumerosDeRodadas[0] : 0;
    rodadaAtual = rodadaParaExibir;

    // Atualiza a tabela imediatamente após carregar o calendário
    await atualizarTabela();

    exibirRodada(rodadaAtual, partidasPorRodada[rodadaAtual]);
    atualizarNavegacao();
  } catch (error) {
    console.error("Erro ao buscar dados:", error);
    document.getElementById("calendario-jogos").innerHTML = `
<div class="error">
  <p><strong>Erro ao carregar os dados:</strong> ${error.message}</p>
</div>
`;
  }
}

function exibirRodada(rodada, partidas) {
  const calendario = document.getElementById("calendario-jogos");
  calendario.innerHTML = "";

  if (!partidas || partidas.length === 0) {
    calendario.innerHTML = `
<div style="text-align: center; grid-column: 1 / -1; padding: 30px;">
  <p>Nenhum jogo encontrado para esta rodada.</p>
</div>
`;
    return;
  }

  partidas.forEach((partida) => {
    const timeCasaInfo = timesInfo[partida.homeTeam.name] || {
      abrev: partida.homeTeam.name.substring(0, 3).toUpperCase(),
      nome: partida.homeTeam.name,
      escudo: "https://logodetimes.com/imagens/generico-256.png",
    };

    const timeForaInfo = timesInfo[partida.awayTeam.name] || {
      abrev: partida.awayTeam.name.substring(0, 3).toUpperCase(),
      nome: partida.awayTeam.name,
      escudo: "https://logodetimes.com/imagens/generico-256.png",
    };

    const temPlacar = partida.score.fullTime.home !== null;
    const statusTexto = traduzirStatus(partida.status);
    const statusClasse = statusClass(partida.status);

    const jogoHTML = `
<div class="jogo">
  <div class="jogo-header">
    <div class="jogo-data">${formatarData(partida.utcDate)}</div>
  </div>

  <div class="jogo-times">
    <div class="time">
      <img src="${timeCasaInfo.escudo}" alt="${
      timeCasaInfo.nome
    }" class="time-escudo" onerror="handleImageError(this)">
      <div class="time-abrev">${timeCasaInfo.abrev}</div>
      <div class="time-nome">${timeCasaInfo.nome}</div>
    </div>
    ${
    temPlacar
      ? `
    <div class="placar">
      <span>${partida.score.fullTime.home}</span>
      <span class="placar-separator">:</span>
      <span>${partida.score.fullTime.away}</span>
    </div>
  `
      : '<div class="versus">X</div>'
  }

    <div class="time">
      <img src="${timeForaInfo.escudo}" alt="${
      timeForaInfo.nome
    }" class="time-escudo" onerror="handleImageError(this)">
      <div class="time-abrev">${timeForaInfo.abrev}</div>
      <div class="time-nome">${timeForaInfo.nome}</div>
    </div>
  </div>

  <div class="jogo-footer">
    <div class="status ${statusClasse}">${statusTexto}</div>
    <div class="horario">${formatarHora(partida.utcDate)}</div>
  </div>
</div>
`;
    calendario.innerHTML += jogoHTML;
  });
}

function atualizarNavegacao() {
  document.getElementById(
    "rodada-atual"
  ).textContent = `Rodada ${rodadaAtual} de ${totalRodadas}`;
  document.getElementById("anterior").disabled = rodadaAtual === 1;
  document.getElementById("proxima").disabled =
    rodadaAtual === totalRodadas;
}

// Funções auxiliares do calendário
function handleImageError(img) {
  img.onerror = null;
  img.src = "https://logodetimes.com/imagens/generico-256.png";
}

function formatarData(dataUTC) {
  const data = new Date(dataUTC);
  const options = { weekday: "long", day: "numeric", month: "long" };
  return data.toLocaleDateString("pt-BR", options);
}

function formatarHora(dataUTC) {
  const data = new Date(dataUTC);
  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function traduzirStatus(status) {
  const statusMap = {
    SCHEDULED: "Agendado",
    TIMED: "Horário Definido",
    IN_PLAY: "Em Andamento",
    PAUSED: "Intervalo",
    FINISHED: "Encerrado",
    POSTPONED: "Adiado",
    SUSPENDED: "Suspenso",
    CANCELED: "Cancelado",
  };
  return statusMap[status] || status;
}

function statusClass(status) {
  if (status === "FINISHED") return "status-FINISHED";
  if (status === "IN_PLAY" || status === "PAUSED") return "status-LIVE";
  return "status-SCHEDULED";
}

// Funções de preenchimento da tabela principal
async function preencherTabelaPrincipalComRodadaAtual(rodada) {
  // Se a rodada solicitada for a mesma que já está exibida
  if (rodadaExibida === rodada) {
    // Apenas atualiza os resultados sem pedir confirmação
    await atualizarTabela();
    return;
  }

  // Se for uma rodada diferente, pede confirmação
  const confirmacao = confirm(
    `Deseja preencher a tabela com a Rodada ${rodada}? As apostas e resultados atuais serão limpos.`
  );
  if (!confirmacao) return;

  try {
    const response = await fetch("/.netlify/functions/fetchMatches");
    if (!response.ok)
      throw new Error(`Erro de rede: ${response.status}`);

    const data = await response.json();
    const jogosRodadaAtual = data.matches.filter(
      (partida) => partida.matchday === rodada
    );

    if (jogosRodadaAtual.length === 0) {
      console.log(`Nenhum jogo encontrado para a rodada ${rodada}.`);
      return;
    }

    // Limpa todos os dados existentes
    const inputsApostas = document.querySelectorAll(".aposta");
    const inputsResultados = document.querySelectorAll(".resultado");

    inputsApostas.forEach((input) => (input.value = ""));
    inputsResultados.forEach((input) => (input.value = ""));

    // Preenche o nome da rodada
    document.getElementById("nome-rodada").value = `Rodada ${rodada}`;

    // Preenche os jogos
    const inputsJogos = document.querySelectorAll(".input-jogo");
    jogosRodadaAtual.forEach((partida, index) => {
      const timeCasaAbrev =
        timesInfo[partida.homeTeam.name]?.abrev ||
        partida.homeTeam.name.substring(0, 3).toUpperCase();
      const timeForaAbrev =
        timesInfo[partida.awayTeam.name]?.abrev ||
        partida.awayTeam.name.substring(0, 3).toUpperCase();
      inputsJogos[index].value = `${timeCasaAbrev} x ${timeForaAbrev}`;
    });

    // Atualiza a rodada exibida
    rodadaExibida = rodada;

    await salvarApostas();
    // Reinicia a atualização automática apenas se for a rodada atual
    if (rodada === rodadaAtual) {
      iniciarAtualizacaoAutomatica();
    } else {
      pararAtualizacaoAutomatica();
    }
  } catch (error) {
    console.error("Erro ao buscar dados da tabela principal:", error);
    alert(
      "Erro ao carregar os dados da tabela principal. Tente novamente."
    );
  }
}

// Funções de atualização automática
async function atualizarTabela() {
  console.log("Atualizando tabela...", {
    rodadaExibida,
    rodadaAtual,
    nomeRodada: document.getElementById("nome-rodada").value,
  });
  try {
    // Verifica se há uma rodada exibida definida
    if (!rodadaExibida) {
      // Tenta obter a rodada do nome_rodada como fallback
      const nomeRodada = document.getElementById("nome-rodada").value;
      const match = nomeRodada.match(/\d+/);
      rodadaExibida = match ? parseInt(match[0]) : null;

      if (!rodadaExibida) {
        console.log("Nenhuma rodada definida na tabela principal.");
        return;
      }
    }

    // Verifica se a rodada exibida na tabela principal é a mesma do calendário
    if (rodadaExibida !== rodadaAtual) {
      console.log(
        `A tabela principal mostra a Rodada ${rodadaExibida}, mas o calendário está na Rodada ${rodadaAtual}. Não atualizando resultados.`
      );
      return;
    }

    const response = await fetch("/.netlify/functions/fetchMatches");
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

    const data = await response.json();
    const jogosRodada = data.matches.filter(
      (m) => m.matchday === rodadaExibida // Usa rodadaExibida em vez de rodadaAtual
    );

    if (jogosRodada.length === 0) {
      console.log(
        `Nenhum jogo encontrado para rodada ${rodadaExibida}`
      );
      return;
    }

    const resultadosAtuais = obterResultadosDaTabela();
    const inputsResultados = document.querySelectorAll(".resultado");
    let resultadosModificados = false;

    jogosRodada.forEach((partida, index) => {
      if (
        partida.score.fullTime.home !== null &&
        partida.score.fullTime.away !== null
      ) {
        const resultadoAtual = resultadosAtuais[index] || {
          time1: "",
          time2: "",
        };
        const novoResultadoCasa =
          partida.score.fullTime.home.toString();
        const novoResultadoFora =
          partida.score.fullTime.away.toString();

        if (
          resultadoAtual.time1 !== novoResultadoCasa ||
          resultadoAtual.time2 !== novoResultadoFora
        ) {
          resultadosModificados = true;
          resultadosAtuais[index] = {
            time1: novoResultadoCasa,
            time2: novoResultadoFora,
          };

          if (
            inputsResultados[index * 2] &&
            inputsResultados[index * 2 + 1]
          ) {
            inputsResultados[index * 2].value = novoResultadoCasa;
            inputsResultados[index * 2 + 1].value = novoResultadoFora;
          }
        }
      }
    });

    if (resultadosModificados) {
      await salvarResultadosNoSupabase(resultadosAtuais);
      console.log("Resultados atualizados e salvos no Supabase!");
      calcularPontuacao();
    } else {
      console.log("Nenhum resultado novo para atualizar.");
    }
  } catch (error) {
    console.error("Erro ao atualizar tabela:", error);
  }
}

async function salvarResultadosNoSupabase(resultados) {
  try {
    const { data, error: fetchError } = await supabaseClient
      .from("alphabet_table")
      .select("*")
      .order("id", { ascending: false })
      .limit(1);

    if (fetchError) throw fetchError;

    if (!data || data.length === 0) {
      console.log(
        "Nenhum registro encontrado para atualizar os resultados"
      );
      return;
    }

    const { error: updateError } = await supabaseClient
      .from("alphabet_table")
      .update({ resultados })
      .eq("id", data[0].id);

    if (updateError) throw updateError;
  } catch (error) {
    console.error("Erro ao salvar resultados:", error);
  }
}

function iniciarAtualizacaoAutomatica() {
  pararAtualizacaoAutomatica();
  atualizarTabela();
  intervaloAtualizacao = setInterval(atualizarTabela, 30000);
}

function pararAtualizacaoAutomatica() {
  if (intervaloAtualizacao) {
    clearInterval(intervaloAtualizacao);
    intervaloAtualizacao = null;
  }
}

// Carregar apostas ao iniciar
async function carregarApostas() {
  try {
    const { data, error } = await supabaseClient
      .from("alphabet_table")
      .select("*")
      .order("id", { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      console.log("Nenhum dado encontrado");
      return;
    }

    const {
      nome_rodada,
      jogos,
      apostas,
      resultados,
      placares_ocultos,
    } = data[0];

    if (nome_rodada) {
      const match = nome_rodada.match(/\d+/); // Extrai qualquer número do nome
      rodadaExibida = match ? parseInt(match[0]) : null;
      console.log(`Rodada carregada: ${rodadaExibida}`, nome_rodada);
    }

    document.getElementById("nome-rodada").value = nome_rodada || "";

    if (!Array.isArray(jogos)) {
      console.error("Erro: jogos não é um array");
      return;
    }

    const inputsJogos = document.querySelectorAll(".input-jogo");
    const inputsApostas = document.querySelectorAll(".aposta");
    const inputsResultados = document.querySelectorAll(".resultado");

    inputsJogos.forEach((input, index) => {
      input.value = jogos[index] || "";
    });

    const jogadores = ["Jardel", "Werbet", "Nailton", "Phillipe"];
    jogadores.forEach((jogador, jogadorIndex) => {
      for (let i = 0; i < 10; i++) {
        const indexCasa = i * 8 + jogadorIndex * 2;
        const indexFora = indexCasa + 1;
        inputsApostas[indexCasa].value =
          apostas[jogador][i].time1 || "";
        inputsApostas[indexFora].value =
          apostas[jogador][i].time2 || "";
      }
    });

    for (let i = 0; i < 10; i++) {
      inputsResultados[i * 2].value = resultados[i].time1 || "";
      inputsResultados[i * 2 + 1].value = resultados[i].time2 || "";
    }

    calcularPontuacao();
    if (placares_ocultos) ocultarPlacares();
    else mostrarPlacares();
  } catch (error) {
    console.error("Erro ao carregar apostas:", error);
  }
}

// Limpar ao sair
window.addEventListener("beforeunload", pararAtualizacaoAutomatica);
