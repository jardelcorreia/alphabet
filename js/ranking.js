// Configuração do Supabase
const SUPABASE_URL = "https://leuyfasvbfwdaloapmrs.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxldXlmYXN2YmZ3ZGFsb2FwbXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExMTczMzUsImV4cCI6MjA1NjY5MzMzNX0.Y_s-KMy9n_Ht2OVaxmQEjnDRniqJ_DcppQVam7uAGk4";

// Inicialização do cliente Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const configCampeonato = {
  valorRodadaAtual: 6,
  valoresRodada: {},
};
const jogadores = ["Jardel", "Werbet", "Nailton", "Phillipe"];

// Função debounce para otimizar chamadas
function debounce(func, wait) {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

function criarInputsRanking() {
  const inputsRanking = document.getElementById("inputs-ranking");

  for (let i = 1; i <= 38; i++) {
    const container = document.createElement("div");
    container.className = "input-container";
    container.dataset.rodada = i;

    // Rótulo da rodada
    const label = document.createElement("div");
    label.textContent = `${i}`;
    label.className = "rodada-label";

    // Valor da rodada
    const valorDiv = document.createElement("div");
    valorDiv.className = "valor-container";

    const valorInput = document.createElement("input");
    valorInput.type = "number";
    valorInput.className = "valor-rodada-input";
    valorInput.min = "1";
    valorInput.step = "1";
    valorInput.value =
      configCampeonato.valoresRodada[i] ||
      configCampeonato.valorRodadaAtual ||
      6;
    valorInput.id = `valor-rodada-${i}`;

    valorDiv.innerHTML = `<span class="currency-prefix">R$</span>`;
    valorDiv.appendChild(valorInput);

    // Campo do vencedor
    const winnerInput = document.createElement("input");
    winnerInput.type = "text";
    winnerInput.placeholder = `Vencedor da Rodada ${i}`;
    winnerInput.id = `rodada-${i}`;
    winnerInput.className = "winner-input";

    // Montagem
    container.appendChild(label);
    container.appendChild(valorDiv);
    container.appendChild(winnerInput);
    inputsRanking.appendChild(container);

    // Event listeners com debounce
    winnerInput.addEventListener(
      "input",
      debounce(() => {
        if (validarInput(winnerInput.value, i)) {
          salvarRanking();
        }
      }, 1000)
    );

    valorInput.addEventListener(
      "input",
      debounce(() => {
        const novoValor = parseFloat(valorInput.value);
        if (!isNaN(novoValor) && novoValor > 0) {
          configCampeonato.valoresRodada[i] = novoValor;
          salvarRanking();
        }
      }, 1000)
    );
  }
}

function validarInput(valor, rodada) {
  if (valor.includes(",") && !valor.includes(", ")) {
    alert(
      `Rodada ${rodada}: Utilize vírgula + espaço entre os nomes no empate. Ex: Jardel, Werbet`
    );
    return false;
  }

  const nomes = valor
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n !== "");

  for (let nome of nomes) {
    if (!jogadores.includes(nome)) {
      alert(
        `Rodada ${rodada}: Nome "${nome}" inválido! Use apenas: ${jogadores.join(
          ", "
        )}`
      );
      return false;
    }
    if (nome[0] !== nome[0]?.toUpperCase()) {
      alert(
        `Rodada ${rodada}: Nome "${nome}" deve começar com letra maiúscula!`
      );
      return false;
    }
  }
  return true;
}

async function carregarRanking() {
  try {
    const { data, error } = await supabaseClient
      .from("alphabet_table")
      .select("*")
      .order("id", { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) return;

    const dadosAtuais = data[0];

    if (dadosAtuais.configuracao) {
      configCampeonato.valorRodadaAtual =
        dadosAtuais.configuracao.valorRodadaAtual || 6;
      configCampeonato.valoresRodada =
        dadosAtuais.configuracao.valoresRodada || {};
    }

    if (dadosAtuais.ranking) {
      dadosAtuais.ranking.forEach((vencedores, index) => {
        const input = document.getElementById(`rodada-${index + 1}`);
        if (input) input.value = vencedores || "";

        const valorInput = document.getElementById(
          `valor-rodada-${index + 1}`
        );
        if (valorInput) {
          valorInput.value =
            configCampeonato.valoresRodada[index + 1] ||
            configCampeonato.valorRodadaAtual ||
            6;
        }
      });
    }

    exibirVitorias(
      dadosAtuais.vitorias_empates ||
        calcularVitoriasEmpatesSaldo(dadosAtuais.ranking || [])
    );
  } catch (error) {
    console.error("Erro ao carregar ranking:", error);
  }
}

function calcularVitoriasEmpatesSaldo(ranking) {
  const vitoriasEmpates = {
    Jardel: { vitorias: 0, empates: 0, saldo: 0 },
    Werbet: { vitorias: 0, empates: 0, saldo: 0 },
    Nailton: { vitorias: 0, empates: 0, saldo: 0 },
    Phillipe: { vitorias: 0, empates: 0, saldo: 0 },
  };

  const jogadores = Object.keys(vitoriasEmpates);

  ranking.forEach((vencedores, rodadaIndex) => {
    if (!vencedores.trim()) return;

    const numeroRodada = rodadaIndex + 1;
    const valorRodada =
      configCampeonato.valoresRodada[numeroRodada] ||
      configCampeonato.valorRodadaAtual;

    const listaVencedores = vencedores
      .split(",")
      .map((nome) => nome.trim())
      .filter((nome) => nome !== "");

    if (listaVencedores.length === 0) return;

    if (listaVencedores.length === 1) {
      const vencedor = listaVencedores[0];
      if (vitoriasEmpates[vencedor]) {
        vitoriasEmpates[vencedor].vitorias++;
        vitoriasEmpates[vencedor].saldo +=
          valorRodada * (jogadores.length - 1);

        jogadores.forEach((jogador) => {
          if (jogador !== vencedor) {
            vitoriasEmpates[jogador].saldo -= valorRodada;
          }
        });
      }
    } else {
      listaVencedores.forEach((vencedor) => {
        if (vitoriasEmpates[vencedor]) {
          vitoriasEmpates[vencedor].empates++;
        }
      });

      const perdedores = jogadores.filter(
        (j) => !listaVencedores.includes(j)
      );

      if (listaVencedores.length === 2) {
        const valorPorPerdedor = valorRodada / 2;
        listaVencedores.forEach((vencedor) => {
          vitoriasEmpates[vencedor].saldo +=
            valorPorPerdedor * perdedores.length;
        });
        perdedores.forEach((perdedor) => {
          vitoriasEmpates[perdedor].saldo -= valorRodada;
        });
      } else if (listaVencedores.length === 3) {
        const valorPorPerdedor = valorRodada / 3;
        listaVencedores.forEach((vencedor) => {
          vitoriasEmpates[vencedor].saldo +=
            valorPorPerdedor * perdedores.length;
        });
        perdedores.forEach((perdedor) => {
          vitoriasEmpates[perdedor].saldo -= valorRodada;
        });
      }
    }
  });

  return vitoriasEmpates;
}

async function salvarRanking() {
  const ranking = [];
  const valoresRodadas = configCampeonato.valoresRodada || {};

  for (let i = 1; i <= 38; i++) {
    const input = document.getElementById(`rodada-${i}`);
    ranking.push(input ? input.value.trim() : "");

    const valorInput = document.getElementById(`valor-rodada-${i}`);
    if (valorInput && valorInput.value) {
      valoresRodadas[i] = parseFloat(valorInput.value);
    }
  }

  try {
    const { data: ultimoRegistro, error: fetchError } =
      await supabaseClient
        .from("alphabet_table")
        .select("id")
        .order("id", { ascending: false })
        .limit(1)
        .single();

    if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

    const dadosParaSalvar = {
      ranking: ranking,
      vitorias_empates: calcularVitoriasEmpatesSaldo(ranking),
      configuracao: {
        valoresRodada: valoresRodadas,
        valorRodadaAtual: configCampeonato.valorRodadaAtual,
      },
    };

    if (ultimoRegistro) {
      const { error: updateError } = await supabaseClient
        .from("alphabet_table")
        .update(dadosParaSalvar)
        .eq("id", ultimoRegistro.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabaseClient
        .from("alphabet_table")
        .insert(dadosParaSalvar);

      if (insertError) throw insertError;
    }

    mostrarIndicadorSalvo();
    exibirVitorias(calcularVitoriasEmpatesSaldo(ranking));
  } catch (error) {
    console.error("Erro ao salvar ranking:", error);
    alert("Erro ao salvar. Verifique sua conexão.");
  }
}

function mostrarIndicadorSalvo() {
  const indicador = document.getElementById("saved-indicator");
  indicador.classList.add("show");
  setTimeout(() => indicador.classList.remove("show"), 3000);
}

function exibirVitorias(resultados) {
  const vitoriasContainer = document.getElementById("vitorias");
  vitoriasContainer.innerHTML = "";

  const resultadosOrdenados = Object.entries(resultados).sort((a, b) => {
    const pontosA = a[1].vitorias * 3 + a[1].empates;
    const pontosB = b[1].vitorias * 3 + b[1].empates;
    if (pontosB !== pontosA) return pontosB - pontosA;
    if (b[1].vitorias !== a[1].vitorias)
      return b[1].vitorias - a[1].vitorias;
    return a[0].localeCompare(b[0]);
  });

  resultadosOrdenados.forEach(
    ([jogador, { vitorias, empates, saldo }], index) => {
      const pontos = vitorias * 3 + empates;
      const card = document.createElement("div");
      card.className = "player-card";
      if (index < 3) card.classList.add(`position-${index + 1}`);
      if (index === 0) card.classList.add("pulse");

      const posicao = document.createElement("div");
      posicao.className = `player-position ${
        index < 3 ? "position-" + (index + 1) : ""
      }`;
      posicao.textContent = index + 1;

      const nome = document.createElement("h3");
      nome.className = "player-name";
      nome.textContent = jogador;

      const statsContainer = document.createElement("div");
      statsContainer.className = "stats-container";

      const statVitorias = document.createElement("div");
      statVitorias.className = "stat";
      statVitorias.innerHTML = `<span class="stat-value">${vitorias}</span><span class="stat-label">Vitórias</span>`;

      const statEmpates = document.createElement("div");
      statEmpates.className = "stat";
      statEmpates.innerHTML = `<span class="stat-value">${empates}</span><span class="stat-label">Empates</span>`;

      const statPontos = document.createElement("div");
      statPontos.className = "stat";
      statPontos.innerHTML = `<span class="stat-value">${pontos}</span><span class="stat-label">Pontos</span>`;

      const statSaldo = document.createElement("div");
      statSaldo.className = "stat";
      statSaldo.innerHTML = `<span class="stat-value ${
        saldo >= 0 ? "text-success" : "text-danger"
      }">R$${saldo.toFixed(
        2
      )}</span><span class="stat-label">Saldo</span>`;

      statsContainer.appendChild(statVitorias);
      statsContainer.appendChild(statEmpates);
      statsContainer.appendChild(statPontos);
      statsContainer.appendChild(statSaldo);

      card.appendChild(posicao);
      card.appendChild(nome);
      card.appendChild(statsContainer);
      vitoriasContainer.appendChild(card);

      setTimeout(() => {
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
      }, index * 150);
    }
  );
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  carregarRanking();
  criarInputsRanking();

  // Verificar dark mode
  const isDarkMode = localStorage.getItem("darkMode") === "true";
  if (isDarkMode) document.body.classList.add("dark-mode");
});
