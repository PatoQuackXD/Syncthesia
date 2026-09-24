const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const resultsDiv = document.getElementById("results");
const submitBtn = document.getElementById("submitBtn");
const confirmacao = document.getElementById("confirmacao");

let selectedVideo = null;
let selectedTitle = null;

// Valores das 3 cores escolhidas (preenchidos pelos callbacks do Pickr)
let cor1Valor = "#ff0000";
let cor2Valor = "#00ff00";
let cor3Valor = "#0000ff";

function criarPicker(seletor, corInicial) {
  return Pickr.create({
    el: seletor,
    theme: "classic",
    default: corInicial,
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

const pickerCor1 = criarPicker("#cor1", cor1Valor);
const pickerCor2 = criarPicker("#cor2", cor2Valor);
const pickerCor3 = criarPicker("#cor3", cor3Valor);

pickerCor1.on("save", (cor) => {
  cor1Valor = cor.toHEXA().toString();
  pickerCor1.hide();
  validarCores();
});
pickerCor2.on("save", (cor) => {
  cor2Valor = cor.toHEXA().toString();
  pickerCor2.hide();
  validarCores();
});
pickerCor3.on("save", (cor) => {
  cor3Valor = cor.toHEXA().toString();
  pickerCor3.hide();
  validarCores();
});

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
  if (cor1Valor && cor2Valor && cor3Valor && cor1Valor !== cor2Valor && cor1Valor !== cor3Valor && cor2Valor !== cor3Valor && selectedVideo) {
    submitBtn.disabled = false;
  } else {
    submitBtn.disabled = true;
  }
}

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
