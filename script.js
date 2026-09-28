const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const resultsDiv = document.getElementById("results");
const submitBtn = document.getElementById("submitBtn");
const confirmacao = document.getElementById("confirmacao");

let selectedVideo = null;
let selectedTitle = null;
let selectedChannel = null;

// Cores escolhidas. null = a pessoa ainda não escolheu essa cor.
// (Não existe mais cor "de fábrica": antes, quem não confirmava no ✓ enviava vermelho/verde/azul sem querer.)
let cor1Valor = null;
let cor2Valor = null;
let cor3Valor = null;

const definirCor = [
  (v) => { cor1Valor = v; },
  (v) => { cor2Valor = v; },
  (v) => { cor3Valor = v; }
];
const lerCor = [() => cor1Valor, () => cor2Valor, () => cor3Valor];

function criarPicker(seletor) {
  return Pickr.create({
    el: seletor,
    theme: "classic",
    default: "#cccccc", // cinza neutro: só a aparência inicial, ainda NÃO conta como escolhida
    swatches: [], // sem cores prontas: vai direto pro seletor livre
    components: {
      preview: true,
      opacity: false,
      hue: true,
      interaction: {
        hex: true,
        input: true,
        save: true
      }
    }
  });
}

// Liga um seletor à variável da cor: o valor acompanha o que a pessoa escolhe,
// sem depender de ela apertar o ✓.
function ligarPicker(picker, indice) {
  picker.on("change", (cor) => {
    definirCor[indice](cor.toHEXA().toString());
    validarCores();
  });
  picker.on("save", (cor) => {
    definirCor[indice](cor.toHEXA().toString());
    picker.hide();
    validarCores();
  });
  // Ao fechar o seletor, o quadradinho passa a mostrar exatamente a cor que vale
  picker.on("hide", () => {
    if (lerCor[indice]() && typeof picker.applyColor === "function") {
      picker.applyColor(true);
    }
  });
}

ligarPicker(criarPicker("#cor1"), 0);
ligarPicker(criarPicker("#cor2"), 1);
ligarPicker(criarPicker("#cor3"), 2);

// Aviso embaixo dos quadradinhos de cor
document.querySelector(".color-group").insertAdjacentHTML(
  "afterend",
  '<div id="dicaCores" style="text-align:center; font-size:14px; color:#666; margin:-4px 0 12px;"></div>'
);

function buscarMusica() {
  const query = searchInput.value.trim();
  if (query.length < 2) {
    resultsDiv.innerHTML = "Digite pelo menos 2 letras.";
    return;
  }

  searchBtn.disabled = true;
  resultsDiv.innerHTML = "Buscando...";

  fetch(`https://meu-backend-jf73.onrender.com/buscar?q=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => {
      resultsDiv.innerHTML = "";

      if (data.error) {
        console.error("Erro da API do YouTube:", data.error);
        resultsDiv.innerHTML = "Não foi possível buscar agora (" + data.error.message + "). Tenta de novo em alguns minutos.";
        return;
      }

      if (!data.items || data.items.length === 0) {
        resultsDiv.innerHTML = "Nenhum resultado encontrado.";
        return;
      }

      data.items.forEach(item => {
        const videoId = item.id.videoId;
        const title = item.snippet.title;
        const channel = item.snippet.channelTitle;
        const thumbnail = item.snippet.thumbnails.default.url;

        const div = document.createElement("div");
        div.classList.add("video");
        div.innerHTML = `
          <img src="${thumbnail}" alt="thumb">
          <span class="video-title" style="cursor:pointer; color:#0066cc; font-weight:bold;">
            ${title}
          </span>
        `;

        // Seleção ao clicar no título
        div.querySelector(".video-title").addEventListener("click", () => {
          selectedVideo = videoId;
          selectedTitle = title;
          selectedChannel = channel;
          resultsDiv.innerHTML = `
            <div class="video selected">
              <img src="${thumbnail}" alt="thumb">
              <span>${title}</span>
            </div>
          `;
          validarCores(); // revalida para liberar o botão
        });

        resultsDiv.appendChild(div);
      });
    })
    .catch(err => {
      console.error("Erro na pesquisa YouTube:", err);
      resultsDiv.innerHTML = "Erro na pesquisa: " + err;
    })
    .finally(() => {
      searchBtn.disabled = false;
    });
}

searchBtn.addEventListener("click", buscarMusica);

// Também permite buscar apertando Enter no campo de texto
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    buscarMusica();
  }
});

// Validação das cores
function validarCores() {
  const cores = [cor1Valor, cor2Valor, cor3Valor];
  const faltam = cores.filter((c) => !c).length;
  const repetidas = new Set(cores.filter(Boolean)).size !== cores.filter(Boolean).length;

  const dica = document.getElementById("dicaCores");
  if (dica) {
    if (faltam > 0) {
      dica.innerText = faltam === 3
        ? "Toque em cada quadrado cinza para escolher uma cor."
        : "Faltam " + faltam + " cor(es) para escolher.";
    } else if (repetidas) {
      dica.innerText = "As 3 cores precisam ser diferentes.";
    } else {
      dica.innerText = "";
    }
  }

  submitBtn.disabled = !(faltam === 0 && !repetidas && selectedVideo);
}
validarCores();

// Submissão
submitBtn.addEventListener("click", () => {
  const musica = searchInput.value;
  const cor1 = cor1Valor;
  const cor2 = cor2Valor;
  const cor3 = cor3Valor;

  if (!selectedVideo) {
    alert("Selecione um vídeo!");
    return;
  }

  console.log("Enviando para backend:", { musica, videoId: selectedVideo, cor1, cor2, cor3 });

  // Trava o botão e avisa o usuário enquanto espera a resposta do backend
  submitBtn.disabled = true;
  submitBtn.classList.add("loading");
  confirmacao.innerText = "Aguarde...";

  // 🔄 Aqui trocamos para a URL pública do Render
  fetch("https://meu-backend-jf73.onrender.com/salvar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ musica, videoId: selectedVideo, cor1, cor2, cor3 })
  })
  .then(res => {
    console.log("Resposta bruta:", res);
    return res.json();
  })
  .then(data => {
    console.log("Resposta JSON:", data);
    confirmacao.innerText = data.mensagem;
    if (data.status === "ok") {
      mostrarPoster({
        videoId: selectedVideo,
        titulo: selectedTitle,
        canal: selectedChannel,
        cores: [cor1, cor2, cor3]
      });
    }
  })
  .catch(err => {
    console.error("Erro no fetch:", err);
    confirmacao.innerText = "Erro ao salvar: " + err;
  })
  .finally(() => {
    submitBtn.classList.remove("loading");
    validarCores(); // volta o botão pro estado normal (habilitado só se ainda válido)
  });
});
